import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { tavily } from '@tavily/core';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { AIModel, TechEntry, AlertSeverity, Manifest } from '@/types';

async function generateWithFallback(genai: GoogleGenAI, prompt: string): Promise<{ text?: string }> {
  const models = ['gemini-2.5-flash'];
  let lastError;
  
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await genai.models.generateContent({
          model,
          contents: prompt,
        });
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[run-scraper] Model ${model} (Attempt ${attempt}/2) failed:`, err?.message || err);
        
        if (err?.status === 429 || err?.status === 503 || err?.message?.includes('demand') || err?.message?.includes('Quota')) {
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }
        break;
      }
    }
  }

  // Fallback to Groq if provided
  if (process.env.GROQ_API_KEY) {
    console.log('[run-scraper] Falling back to Groq API...');
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        return { text: data.choices[0]?.message?.content ?? '' };
      }
    } catch (e) {
      console.warn('[run-scraper] Groq request failed:', e);
    }
  }

  throw lastError;
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
    const response = await client.search(query, {
      searchDepth: 'basic',
      maxResults: 5,
    });
    return (response.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

async function analyzeWithGemini(
  genai: GoogleGenAI,
  subject: string,
  searchResults: TavilyResult[],
  type: 'ai_model' | 'framework'
): Promise<Array<{ title: string; description: string; severity: AlertSeverity; source_url: string }>> {
  if (searchResults.length === 0) return [];

  const typeContext = type === 'ai_model'
    ? 'pricing changes, model deprecations, new cheaper/better alternatives, API breaking changes'
    : 'new major releases, breaking changes, deprecation notices, security advisories';

  try {
    const prompt = `You are a technical intelligence analyst for a startup CTO. Analyze these search results about "${subject}" and identify important alerts related to: ${typeContext}.

SEARCH RESULTS:
${JSON.stringify(searchResults, null, 2)}

Identify any critical framework deprecations, major version releases, pricing changes, or architectural shifts.
If nothing is urgent or significant, return an empty array [].

Return ONLY a JSON array of objects matching this schema exactly:
[{
  "title": "Short urgent title (e.g., Next.js 16 Released)",
  "description": "2-3 sentences explaining the impact on the founder",
  "severity": "critical" | "high" | "medium" | "low" | "info",
  "source_url": "URL from the search results"
}]`;
    const result = await generateWithFallback(genai, prompt);
    const text = result.text ?? '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: manifest } = await supabase
      .from('manifests')
      .select('*')
      .eq('user_id', user.id)
      .single<Manifest>();

    if (!manifest || !manifest.parsed_manifest) {
      return NextResponse.json({ success: false, error: 'No analyzed manifest found' }, { status: 404 });
    }

    const { data: agentRun, error: runErr } = await supabase
      .from('agent_runs')
      .insert({ manifest_id: manifest.id, agent: 'scraper', status: 'running' })
      .select()
      .single();

    if (runErr || !agentRun) throw runErr ?? new Error('Failed to create agent run');

    try {
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const parsedManifest = manifest.parsed_manifest;
      const newAlerts = [];

      const aiModels: AIModel[] = parsedManifest?.ai_models ?? [];
      for (const model of aiModels.slice(0, 5)) {
        const subject = `${model.provider} ${model.model}`;
        const queries = [`${model.provider} ${model.model} pricing change 2025`, `${model.provider} ${model.model} deprecated alternative`];
        const results = (await Promise.all(queries.map(tavilySearch))).flat();
        const alerts = await analyzeWithGemini(genai, subject, results, 'ai_model');
        
        for (const alert of alerts) {
          newAlerts.push({ ...alert, manifest_id: manifest.id, user_id: user.id, agent: 'scraper', affected_package: subject, is_read: false });
        }
      }

      const frameworks: TechEntry[] = parsedManifest?.frameworks ?? [];
      for (const fw of frameworks.slice(0, 5)) {
        const queries = [`${fw.name} new release breaking changes 2025`, `${fw.name} deprecation notice`];
        const results = (await Promise.all(queries.map(tavilySearch))).flat();
        const alerts = await analyzeWithGemini(genai, fw.name, results, 'framework');

        for (const alert of alerts) {
          newAlerts.push({ ...alert, manifest_id: manifest.id, user_id: user.id, agent: 'scraper', affected_package: fw.name, is_read: false });
        }
      }

      // Delete old scraper alerts for this manifest
      await supabase.from('alerts').delete().eq('manifest_id', manifest.id).eq('agent', 'scraper');

      if (newAlerts.length > 0) {
        await supabase.from('alerts').insert(newAlerts as any);
      }

      await supabase
        .from('agent_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);

      return NextResponse.json({ success: true, data: { agentRun, alertsCreated: newAlerts.length } });
    } catch (innerError) {
      const message = innerError instanceof Error ? innerError.message : 'Internal server error';
      await supabase
        .from('agent_runs')
        .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
      throw innerError;
    }
  } catch (error) {
    console.error('[run-scraper] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
