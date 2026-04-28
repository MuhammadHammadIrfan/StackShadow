import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { tavily } from '@tavily/core';
import { createClient } from '@/lib/supabase/server';
import type { AIModel, TechEntry, AlertSeverity, Manifest } from '@/types';

// ── SSE helper ──────────────────────────────────────────────────────────────
function encodeEvent(data: string) {
  return new TextEncoder().encode(`data: ${JSON.stringify({ log: data })}\n\n`);
}

function sseEnd(controller: ReadableStreamDefaultController) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true })}\n\n`));
  controller.close();
}

// ── LLM fallback chain ───────────────────────────────────────────────────────
async function generateWithFallback(
  genai: GoogleGenAI,
  prompt: string,
  log: (msg: string) => void,
): Promise<string> {
  const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];

  for (const model of geminiModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        log(`[Gemini] Trying ${model} (attempt ${attempt}/2)...`);
        const result = await genai.models.generateContent({ model, contents: prompt });
        const text = result.text ?? '';
        log(`[Gemini] ✓ ${model} responded (${text.length} chars)`);
        return text;
      } catch (err: any) {
        log(`[Gemini] ✗ ${model} failed: ${err?.message?.slice(0, 80)}`);
        if (err?.status === 404) break;
        if (err?.status === 429 || err?.status === 503) {
          await new Promise(r => setTimeout(r, attempt * 1000));
          continue;
        }
        break;
      }
    }
  }

  // Groq fallback
  if (process.env.GROQ_API_KEY) {
    const groqModels = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
    for (const gModel of groqModels) {
      log(`[Groq] Falling back to ${gModel}...`);
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: gModel, messages: [{ role: 'user', content: prompt }] }),
        });
        if (res.ok) {
          const data = await res.json();
          const text = data.choices[0]?.message?.content ?? '';
          log(`[Groq] ✓ ${gModel} responded (${text.length} chars)`);
          return text;
        } else {
          const errText = await res.text();
          log(`[Groq] ✗ ${gModel} failed: ${errText.slice(0, 100)}`);
          if (res.status === 429) continue;
          break;
        }
      } catch (e: any) {
        log(`[Groq] ✗ ${gModel} error: ${e?.message?.slice(0, 80)}`);
      }
    }
  }

  throw new Error('All LLM providers exhausted');
}

// ── Tavily search ──────────────────────────────────────────────────────────
interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function tavilySearch(query: string): Promise<TavilyResult[]> {
  try {
    const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
    const response = await client.search(query, { searchDepth: 'basic', maxResults: 5 });
    return (response.results ?? []) as TavilyResult[];
  } catch {
    return [];
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let log: (msg: string) => void = () => { };

  const stream = new ReadableStream({
    async start(controller) {
      log = (msg: string) => {
        try { controller.enqueue(encodeEvent(msg)); } catch { }
      };

      try {
        let manifest_id: string | undefined;
        try {
          const body = await request.json();
          manifest_id = body.manifest_id;
        } catch { }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          log('[System] ✗ Unauthorized');
          sseEnd(controller);
          return;
        }

        let manifestQuery = supabase.from('manifests').select('*').eq('user_id', user.id);
        if (manifest_id) manifestQuery = manifestQuery.eq('id', manifest_id);
        const { data: manifest } = await manifestQuery.order('created_at', { ascending: false }).limit(1).single<Manifest>();

        if (!manifest || !manifest.parsed_manifest) {
          log('[System] ✗ No manifest found');
          sseEnd(controller);
          return;
        }

        log(`[System] ► Scraper Agent started`);
        log(`[System] Target: ${manifest.repo_name}`);

        const { data: agentRun, error: runErr } = await supabase
          .from('agent_runs').insert({ manifest_id: manifest.id, agent: 'scraper', status: 'running' }).select().single();
        if (runErr || !agentRun) { log('[System] ✗ Failed to create agent run'); sseEnd(controller); return; }

        try {
          const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const parsedManifest = manifest.parsed_manifest;

          const aiModels: AIModel[] = parsedManifest?.ai_models ?? [];
          const frameworks: TechEntry[] = parsedManifest?.frameworks ?? [];
          const languages: string[] = parsedManifest?.languages ?? [];
          const databases: string[] = parsedManifest?.databases ?? [];
          const infrastructure: string[] = parsedManifest?.infrastructure ?? [];
          const keyDeps: TechEntry[] = parsedManifest?.key_dependencies ?? [];

          // Build comprehensive search subjects with fallback to languages/databases/infra
          const subjects: Array<{ name: string; type: string; queries: string[] }> = [];

          for (const m of aiModels.slice(0, 4)) {
            const name = `${m.provider} ${m.model}`;
            subjects.push({
              name, type: 'ai_model', queries: [
                `${name} pricing change 2025`,
                `${name} deprecated alternative`,
              ]
            });
          }

          for (const fw of frameworks.slice(0, 4)) {
            subjects.push({
              name: fw.name, type: 'framework', queries: [
                `${fw.name} new release breaking changes 2025`,
                `${fw.name} deprecation notice`,
              ]
            });
          }

          // Fallback: if no ai_models/frameworks, search top deps, languages, dbs
          if (subjects.length === 0) {
            for (const dep of keyDeps.slice(0, 4)) {
              subjects.push({
                name: dep.name, type: 'dependency', queries: [
                  `${dep.name} security advisory 2025`,
                  `${dep.name} breaking change deprecated`,
                ]
              });
            }
            for (const lang of languages.slice(0, 2)) {
              subjects.push({
                name: lang, type: 'language', queries: [
                  `${lang} new features deprecation 2025`,
                ]
              });
            }
            for (const db of databases.slice(0, 2)) {
              subjects.push({
                name: db, type: 'database', queries: [
                  `${db} pricing change deprecation 2025`,
                ]
              });
            }
            for (const infra of infrastructure.slice(0, 2)) {
              subjects.push({
                name: infra, type: 'infrastructure', queries: [
                  `${infra} breaking change pricing 2025`,
                ]
              });
            }
          }

          if (subjects.length === 0) {
            log(`[Scraper] No searchable subjects found in manifest`);
          } else {
            log(`[Scraper] Identified ${subjects.length} subjects to monitor: ${subjects.map(s => s.name).join(', ')}`);
          }

          log(`[Scraper] Querying Tavily web intelligence...`);
          const allSearchResults: Array<{ subject: string; type: string; results: TavilyResult[] }> = [];

          for (const subject of subjects) {
            const resultGroups = await Promise.all(subject.queries.map(tavilySearch));
            const results = resultGroups.flat().filter(r => r.score > 0.3);
            log(`[Scraper] ${subject.name}: ${results.length} web results found`);
            allSearchResults.push({ subject: subject.name, type: subject.type, results });
          }

          const hasResults = allSearchResults.some(r => r.results.length > 0);
          if (!hasResults) {
            log(`[Scraper] No web intelligence found. Nothing to analyze.`);
            await supabase.from('alerts').delete().eq('manifest_id', manifest.id).eq('agent', 'scraper');
            await supabase.from('agent_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', agentRun.id);
            log(`[System] ✓ Scraper complete - 0 alerts`);
            sseEnd(controller);
            return;
          }

          log(`[Scraper] Sending results to LLM for intelligence analysis...`);

          const prompt = `You are a technical intelligence analyst for a startup CTO. Analyze the following batched search results for several technologies and identify important alerts.

For AI Models: look for pricing changes, model deprecations, new cheaper/better alternatives, API breaking changes.
For Frameworks/Languages/Libraries: look for new major releases, breaking changes, deprecation notices, security advisories.
For Databases/Infrastructure: look for pricing changes, deprecations, major incidents.

SEARCH RESULTS BATCH:
${JSON.stringify(allSearchResults, null, 2)}

Identify any critical deprecations, major version releases, pricing changes, or architectural shifts.
For EACH alert, also provide a solution object with: the recommended action, a URL for the fix, best alternatives (name+url pairs), and the proof URL showing the deprecation/issue.
If nothing is urgent or significant, return an empty array [].
DO NOT use emojis in your output.

Return ONLY a JSON array of objects matching this schema exactly:
[{
  "title": "Short urgent title (e.g., Next.js 16 Released)",
  "description": "2-3 sentences explaining the impact on the founder",
  "severity": "critical" | "high" | "medium" | "low" | "info",
  "source_url": "URL from the search results",
  "affected_package": "The exact name of the technology",
  "solution": {
    "recommendation": "Short action to take (e.g. Upgrade to v16.2, Switch to alternative X)",
    "fix_url": "URL to the fix, new version, or migration guide",
    "proof_url": "URL proving the issue (changelog, deprecation notice, advisory)",
    "alternatives": [{"name": "Alternative name", "url": "https://..."}]
  }
}]`;

          const rawText = await generateWithFallback(genai, prompt, log);
          log(`\n[LLM Raw Response]\n${rawText.slice(0, 1500)}${rawText.length > 1500 ? '...' : ''}`);

          const jsonMatch = rawText.match(/\[[\s\S]*\]/);
          const newAlerts: any[] = [];

          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              log(`[Scraper] LLM identified ${parsed.length} actionable intelligence items`);
              for (const alert of parsed) {
                newAlerts.push({
                  ...alert,
                  manifest_id: manifest.id,
                  user_id: user.id,
                  agent: 'scraper',
                  is_read: false,
                  solution: alert.solution ?? null,
                });
              }
            } catch {
              log(`[Scraper] ✗ Failed to parse LLM JSON response`);
            }
          } else {
            log(`[Scraper] LLM found no actionable intelligence`);
          }

          await supabase.from('alerts').delete().eq('manifest_id', manifest.id).eq('agent', 'scraper');
          if (newAlerts.length > 0) await supabase.from('alerts').insert(newAlerts);

          // ── Pricing Analysis Pass ─────────────────────────────────────
          log(`[Scraper] Starting pricing analysis...`);

          const allTech = [
            ...aiModels.map(m => ({ name: `${m.provider} ${m.model}`, type: 'ai_model' })),
            ...frameworks.map(f => ({ name: f.name, type: 'framework' })),
            ...databases.map(d => ({ name: d, type: 'database' })),
            ...infrastructure.map(i => ({ name: i, type: 'infrastructure' })),
            ...keyDeps.slice(0, 8).map(d => ({ name: d.name, type: 'dependency' })),
          ];

          const pricingPrompt = `You are a cloud cost optimization expert. Given this project's tech stack, analyze each item and determine if it is a paid service or free/open-source.

TECH STACK:
${JSON.stringify(allTech, null, 2)}

For EACH item, determine:
1. Is it a paid API/service/product, or free/open-source?
2. If paid: estimate the typical monthly cost for a startup (in USD). Be realistic based on common usage tiers.
3. If paid: suggest a cheaper or free alternative with its estimated monthly cost and a URL to learn more.
4. Estimate the billing cycle (e.g. "monthly", "per-request", "annual").

Return ONLY valid JSON matching this schema:
{
  "items": [
    {
      "name": "Service name",
      "type": "ai_model|framework|database|infrastructure|dependency",
      "is_paid": true/false,
      "current_cost": 0.00,
      "alternative_name": "Cheaper option or empty string",
      "alternative_cost": 0.00,
      "alternative_url": "https://...",
      "billing_cycle": "monthly|per-request|annual|free"
    }
  ],
  "total_current": 0.00,
  "total_recommended": 0.00
}

Rules:
- DO NOT USE EMOJIS in any part of the output.
- CRITICAL: Perform multiple internal checks before returning cost estimates. Do not hallucinate pricing. Base estimates strictly on official pricing tiers.
- current_cost and alternative_cost are monthly estimates in USD
- For free tools, set current_cost to 0 and is_paid to false
- total_current = sum of all current_cost values
- total_recommended = sum of all (alternative_cost where is_paid=true, else current_cost)
- Be conservative with estimates, use startup-tier pricing not enterprise`;

          try {
            const pricingRaw = await generateWithFallback(genai, pricingPrompt, log);
            log(`[Scraper] Pricing analysis response received`);
            const pricingJsonMatch = pricingRaw.match(/\{[\s\S]*\}/);
            if (pricingJsonMatch) {
              const pricingData = JSON.parse(pricingJsonMatch[0]);
              // Delete old pricing for this manifest and insert new
              await supabase.from('pricing_analysis').delete().eq('manifest_id', manifest.id);
              await supabase.from('pricing_analysis').insert({
                manifest_id: manifest.id,
                user_id: user.id,
                items: pricingData.items ?? [],
                total_current: pricingData.total_current ?? 0,
                total_recommended: pricingData.total_recommended ?? 0,
              });
              const paidCount = (pricingData.items ?? []).filter((i: any) => i.is_paid).length;
              log(`[Scraper] ✓ Pricing analysis saved - ${paidCount} paid services, $${pricingData.total_current ?? 0}/mo estimated`);
            }
          } catch (pricingErr: any) {
            log(`[Scraper] ⚠ Pricing analysis skipped: ${pricingErr?.message?.slice(0, 80)}`);
          }

          await supabase.from('agent_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', agentRun.id);

          log(`[System] ✓ Scraper complete - ${newAlerts.length} alerts saved`);

        } catch (innerError: any) {
          const msg = innerError?.message ?? 'Unknown error';
          log(`[System] ✗ Scraper error: ${msg}`);
          await supabase.from('agent_runs').update({ status: 'failed', error: msg, completed_at: new Date().toISOString() }).eq('id', agentRun.id);
        }

      } catch (e: any) {
        log(`[System] ✗ Fatal error: ${e?.message}`);
      }

      sseEnd(controller);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
