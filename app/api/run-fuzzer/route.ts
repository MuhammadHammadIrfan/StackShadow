import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import type { Manifest, TechEntry, Alert, AgentRun, AlertSeverity } from '@/types';

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
        console.warn(`[run-fuzzer] Model ${model} (Attempt ${attempt}/2) failed:`, err?.message || err);
        
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
    console.log('[run-fuzzer] Falling back to Groq API...');
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
      console.warn('[run-fuzzer] Groq request failed:', e);
    }
  }

  throw lastError;
}

interface OsvVulnerability {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  references?: Array<{ type: string; url: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{ package: { name: string; ecosystem: string } }>;
}

async function queryOsv(dep: TechEntry): Promise<OsvVulnerability[]> {
  try {
    const body = dep.version
      ? { version: dep.version, package: { name: dep.name, ecosystem: 'npm' } }
      : { package: { name: dep.name, ecosystem: 'npm' } };

    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.vulns ?? []).slice(0, 5); // Cap at 5 vulns per package
  } catch {
    return [];
  }
}

async function queryGithubAdvisories(dep: TechEntry): Promise<OsvVulnerability[]> {
  try {
    const query = `
      query($name: String!) {
        securityVulnerabilities(ecosystem: NPM, package: $name, first: 5) {
          nodes {
            advisory {
              ghsaId
              summary
              description
              severity
              references { url }
            }
            vulnerableVersionRange
            firstPatchedVersion { identifier }
          }
        }
      }
    `;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables: { name: dep.name } }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const nodes = data?.data?.securityVulnerabilities?.nodes ?? [];

    // Normalize to OSV-like shape for unified processing
    return nodes.map((n: { advisory: { ghsaId: string; summary: string; description: string; severity: string; references: Array<{ url: string }> }; vulnerableVersionRange: string; firstPatchedVersion?: { identifier: string } }) => ({
      id: n.advisory.ghsaId,
      summary: n.advisory.summary,
      details: `${n.advisory.description}\n\nVulnerable range: ${n.vulnerableVersionRange}. Patched in: ${n.firstPatchedVersion?.identifier ?? 'unknown'}`,
      database_specific: { severity: n.advisory.severity },
      references: n.advisory.references,
    }));
  } catch {
    return [];
  }
}

function mapSeverity(vuln: OsvVulnerability): AlertSeverity {
  const s = vuln.database_specific?.severity?.toLowerCase() ?? '';
  if (s === 'critical') return 'critical';
  if (s === 'high') return 'high';
  if (s === 'moderate' || s === 'medium') return 'medium';
  if (s === 'low') return 'low';

  // Try CVSS score
  const cvss = vuln.severity?.find(sv => sv.type === 'CVSS_V3')?.score;
  if (cvss) {
    const score = parseFloat(cvss);
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
  }
  return 'medium';
}

// summarizeWithGemini removed in favor of Prompt Batching

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

    // Create Agent Run via standard client
    const { data: agentRun, error: runErr } = await supabase
      .from('agent_runs')
      .insert({ manifest_id: manifest.id, agent: 'fuzzer', status: 'running' })
      .select()
      .single<AgentRun>();

    if (runErr || !agentRun) throw runErr ?? new Error('Failed to create agent run');

    try {
      const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const parsedManifest = manifest.parsed_manifest;
      const allDeps: TechEntry[] = [
        ...(parsedManifest?.frameworks ?? []),
        ...(parsedManifest?.key_dependencies ?? []),
      ].slice(0, 20); // Cap to 20 to stay within rate limits

      const allVulnsToAnalyze: { dep: TechEntry, vuln: OsvVulnerability }[] = [];

      for (const dep of allDeps) {
        const [osvVulns, ghVulns] = await Promise.all([
          queryOsv(dep),
          queryGithubAdvisories(dep),
        ]);

        const seen = new Set<string>();
        const allVulns = [...osvVulns, ...ghVulns].filter(v => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        });

        allVulns.forEach(v => allVulnsToAnalyze.push({ dep, vuln: v }));
      }

      const newAlerts = [];

      if (allVulnsToAnalyze.length > 0) {
        const vulnsJsonString = JSON.stringify(allVulnsToAnalyze.map(item => ({
          package_name: item.dep.name,
          package_version: item.dep.version ?? 'unknown',
          cve_id: item.vuln.id,
          summary: item.vuln.summary ?? 'No summary',
          details: (item.vuln.details ?? '').slice(0, 600)
        })));

        const prompt = `You are a strict security advisor. Analyze this list of vulnerabilities against the specific package versions provided.
        
VULNERABILITIES:
${vulnsJsonString}

For EACH vulnerability:
1. Is the specific package version strictly affected according to the details? (If patched, out of range, or irrelevant, it is a false positive).
2. If it is a real threat, summarize the risk and what action to take for a non-expert founder in 2-3 sentences.

Return ONLY a JSON array of valid vulnerabilities (exclude false positives completely).
Schema:
[{
  "cve_id": "string",
  "package_name": "string",
  "summary": "string (your 2-3 sentence summary)"
}]`;

        const result = await generateWithFallback(genai, prompt);
        const text = result.text?.trim() ?? '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
          try {
            const parsedResults = JSON.parse(jsonMatch[0]);
            
            for (const pr of parsedResults) {
              const original = allVulnsToAnalyze.find(v => v.vuln.id === pr.cve_id && v.dep.name === pr.package_name);
              if (original) {
                const severity = mapSeverity(original.vuln);
                const sourceUrl = original.vuln.references?.[0]?.url ?? `https://osv.dev/vulnerability/${original.vuln.id}`;
                
                newAlerts.push({
                  manifest_id: manifest.id,
                  user_id: user.id,
                  agent: 'fuzzer',
                  severity,
                  title: `${original.dep.name}: ${original.vuln.summary ?? original.vuln.id}`,
                  description: pr.summary,
                  source_url: sourceUrl,
                  affected_package: `${original.dep.name}${original.dep.version ? `@${original.dep.version}` : ''}`,
                  is_read: false,
                });
              }
            }
          } catch (e) {
            console.error('[run-fuzzer] Error parsing batched Gemini JSON:', e);
          }
        }
      }

      // Delete old fuzzer alerts for this manifest
      await supabase.from('alerts').delete().eq('manifest_id', manifest.id).eq('agent', 'fuzzer');

      // Insert new alerts
      if (newAlerts.length > 0) {
        await supabase.from('alerts').insert(newAlerts as any);
      }

      // Update run status
      await supabase
        .from('agent_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);

      return NextResponse.json({
        success: true,
        data: { agentRun: { ...agentRun, status: 'completed' }, alertsCreated: newAlerts.length },
      });
    } catch (innerError) {
      const message = innerError instanceof Error ? innerError.message : 'Internal server error';
      await supabase
        .from('agent_runs')
        .update({ status: 'failed', error: message, completed_at: new Date().toISOString() })
        .eq('id', agentRun.id);
      throw innerError;
    }
  } catch (error) {
    console.error('[run-fuzzer] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
