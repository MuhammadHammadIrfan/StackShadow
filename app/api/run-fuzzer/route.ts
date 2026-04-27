import { NextRequest } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import type { Manifest, TechEntry, Alert, AgentRun, AlertSeverity } from '@/types';

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

// ── Ecosystem detection ──────────────────────────────────────────────────────
function getEcosystem(languages: string[]): string {
  const lang = (languages ?? []).map(l => l.toLowerCase());
  if (lang.some(l => l.includes('python'))) return 'PyPI';
  if (lang.some(l => l.includes('go'))) return 'Go';
  if (lang.some(l => l.includes('java') || l.includes('kotlin') || l.includes('scala'))) return 'Maven';
  if (lang.some(l => l.includes('rust'))) return 'crates.io';
  if (lang.some(l => l.includes('ruby'))) return 'RubyGems';
  if (lang.some(l => l.includes('php'))) return 'Packagist';
  if (lang.some(l => l.includes('swift'))) return 'SwiftURL';
  return 'npm'; // default
}

// ── OSV query (multi-ecosystem) ──────────────────────────────────────────────
interface OsvVulnerability {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  references?: Array<{ type: string; url: string }>;
  database_specific?: { severity?: string };
  affected?: Array<{ package: { name: string; ecosystem: string } }>;
}

async function queryOsv(dep: TechEntry, ecosystem: string): Promise<OsvVulnerability[]> {
  try {
    const body = dep.version
      ? { version: dep.version, package: { name: dep.name, ecosystem } }
      : { package: { name: dep.name, ecosystem } };

    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.vulns ?? []).slice(0, 5);
  } catch {
    return [];
  }
}

async function queryGithubAdvisories(dep: TechEntry, ecosystem: string): Promise<OsvVulnerability[]> {
  try {
    // GitHub Advisories only supports certain ecosystems
    const ghEcosystemMap: Record<string, string> = {
      'npm': 'NPM',
      'PyPI': 'PIP',
      'Maven': 'MAVEN',
      'Go': 'GO',
      'RubyGems': 'RUBYGEMS',
      'crates.io': 'RUST',
    };
    const ghEcosystem = ghEcosystemMap[ecosystem];
    if (!ghEcosystem) return [];

    const query = `
      query($name: String!, $eco: SecurityAdvisoryEcosystem!) {
        securityVulnerabilities(ecosystem: $eco, package: $name, first: 5) {
          nodes {
            advisory { ghsaId summary description severity references { url } }
            vulnerableVersionRange
            firstPatchedVersion { identifier }
          }
        }
      }
    `;
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { name: dep.name, eco: ghEcosystem } }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const nodes = data?.data?.securityVulnerabilities?.nodes ?? [];
    return nodes.map((n: any) => ({
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

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  let log: (msg: string) => void = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      log = (msg: string) => {
        try { controller.enqueue(encodeEvent(msg)); } catch {}
      };

      try {
        let manifest_id: string | undefined;
        try {
          const body = await request.json();
          manifest_id = body.manifest_id;
        } catch {}

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

        log(`[System] ► Fuzzer Agent started`);
        log(`[System] Target: ${manifest.repo_name}`);

        const { data: agentRun, error: runErr } = await supabase
          .from('agent_runs').insert({ manifest_id: manifest.id, agent: 'fuzzer', status: 'running' }).select().single<AgentRun>();
        if (runErr || !agentRun) { log('[System] ✗ Failed to create agent run'); sseEnd(controller); return; }

        try {
          const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
          const parsedManifest = manifest.parsed_manifest;
          const ecosystem = getEcosystem(parsedManifest?.languages ?? []);
          log(`[Fuzzer] Detected ecosystem: ${ecosystem}`);

          const allDeps: TechEntry[] = [
            ...(parsedManifest?.frameworks ?? []),
            ...(parsedManifest?.key_dependencies ?? []),
          ].slice(0, 20);

          log(`[Fuzzer] Scanning ${allDeps.length} dependencies via OSV.dev + GitHub Advisories...`);

          const allVulnsToAnalyze: { dep: TechEntry; vuln: OsvVulnerability }[] = [];
          for (const dep of allDeps) {
            const [osvVulns, ghVulns] = await Promise.all([queryOsv(dep, ecosystem), queryGithubAdvisories(dep, ecosystem)]);
            const seen = new Set<string>();
            const allVulns = [...osvVulns, ...ghVulns].filter(v => { if (seen.has(v.id)) return false; seen.add(v.id); return true; });
            if (allVulns.length > 0) log(`[Fuzzer] ${dep.name}: found ${allVulns.length} vulnerability reports`);
            allVulns.forEach(v => allVulnsToAnalyze.push({ dep, vuln: v }));
          }

          const newAlerts: any[] = [];

          if (allVulnsToAnalyze.length === 0) {
            log(`[Fuzzer] No vulnerability reports found. Clean dependency scan.`);
          } else {
            log(`[Fuzzer] Sending ${allVulnsToAnalyze.length} vulnerabilities to LLM for analysis...`);

            const vulnsJsonString = JSON.stringify(allVulnsToAnalyze.map(item => ({
              package_name: item.dep.name,
              package_version: item.dep.version ?? 'unknown',
              cve_id: item.vuln.id,
              summary: item.vuln.summary ?? 'No summary',
              details: (item.vuln.details ?? '').slice(0, 600),
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

            const rawText = await generateWithFallback(genai, prompt, log);
            log(`\n[LLM Raw Response]\n${rawText.slice(0, 1200)}${rawText.length > 1200 ? '...' : ''}`);

            const jsonMatch = rawText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              try {
                const parsedResults = JSON.parse(jsonMatch[0]);
                log(`[Fuzzer] LLM confirmed ${parsedResults.length} real vulnerabilities after false-positive filtering`);
                for (const pr of parsedResults) {
                  const original = allVulnsToAnalyze.find(v => v.vuln.id === pr.cve_id && v.dep.name === pr.package_name);
                  if (original) {
                    newAlerts.push({
                      manifest_id: manifest.id,
                      user_id: user.id,
                      agent: 'fuzzer',
                      severity: mapSeverity(original.vuln),
                      title: `${original.dep.name}: ${original.vuln.summary ?? original.vuln.id}`,
                      description: pr.summary,
                      source_url: original.vuln.references?.[0]?.url ?? `https://osv.dev/vulnerability/${original.vuln.id}`,
                      affected_package: `${original.dep.name}${original.dep.version ? `@${original.dep.version}` : ''}`,
                      is_read: false,
                    });
                  }
                }
              } catch (e) {
                log(`[Fuzzer] ✗ Failed to parse LLM JSON response`);
              }
            } else {
              log(`[Fuzzer] LLM returned no JSON — no confirmed vulnerabilities`);
            }
          }

          await supabase.from('alerts').delete().eq('manifest_id', manifest.id).eq('agent', 'fuzzer');
          if (newAlerts.length > 0) await supabase.from('alerts').insert(newAlerts);
          await supabase.from('agent_runs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', agentRun.id);

          log(`[System] ✓ Fuzzer complete — ${newAlerts.length} alerts saved`);

        } catch (innerError: any) {
          const msg = innerError?.message ?? 'Unknown error';
          log(`[System] ✗ Fuzzer error: ${msg}`);
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
