import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import type { ParsedManifest, ScanRepoRequest } from '@/types';

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
        console.warn(`[scan-repo] Model ${model} (Attempt ${attempt}/2) failed:`, err?.message || err);
        
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
    console.log('[scan-repo] Falling back to Groq API...');
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
      } else {
        console.warn('[scan-repo] Groq failed:', await res.text());
      }
    } catch (e) {
      console.warn('[scan-repo] Groq request failed:', e);
    }
  }

  throw lastError;
}

const FILES_TO_FETCH = [
  'package.json',
  'requirements.txt',
  'pyproject.toml',
  'README.md',
  'Cargo.toml',
  'go.mod',
  'build.gradle',
  'build.gradle.kts',
  'pom.xml',
  'Podfile',
  'docker-compose.yml',
  'Dockerfile',
  'Gemfile',
];

async function fetchRepoFiles(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  await Promise.allSettled(
    FILES_TO_FETCH.map(async (path) => {
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
        });
        if ('content' in data && data.encoding === 'base64') {
          files[path] = Buffer.from(data.content, 'base64').toString('utf-8');
        }
      } catch {
        // File doesn't exist — skip silently
      }
    })
  );

  return files;
}

function buildManifestPrompt(files: Record<string, string>): string {
  const fileContent = Object.entries(files)
    .map(([name, content]) => `### ${name}\n\`\`\`\n${content.slice(0, 3000)}\n\`\`\``)
    .join('\n\n');

  return `You are a senior software architect. Analyze these repository files and extract the technical stack.

${fileContent}

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{
  "languages": ["string"],
  "frameworks": [{"name": "string", "version": "string"}],
  "ai_models": [{"provider": "string", "model": "string", "version": "string"}],
  "databases": ["string"],
  "infrastructure": ["string"],
  "key_dependencies": [{"name": "string", "version": "string"}]
}

Rules:
- Include ALL frameworks found (web, mobile, ML, testing, desktop, etc.)
- For mobile/desktop, identify Android, iOS, React Native, Flutter, Electron, Swift, Kotlin, Java, Spring, Ruby on Rails, etc.
- For ai_models, look for OpenAI, Anthropic, Cohere, HuggingFace, LangChain, LlamaIndex, multi-agent frameworks, etc.
- version can be empty string if unknown
- key_dependencies: include the 15 most important non-framework packages
- databases: include PostgreSQL, Redis, MongoDB, Supabase, Prisma, etc.
- infrastructure: include Docker, Kubernetes, Vercel, AWS, GCP, GitHub Actions, etc.`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ScanRepoRequest = await request.json();
    const { repoUrl, githubToken } = body;

    if (!repoUrl || !githubToken) {
      return NextResponse.json(
        { success: false, error: 'repoUrl and githubToken are required' },
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const urlPattern = /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/;
    const match = repoUrl.match(urlPattern);
    if (!match) {
      return NextResponse.json(
        { success: false, error: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo' },
        { status: 400 }
      );
    }
    const [, owner, repo] = match;

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch files from GitHub
    const octokit = new Octokit({ auth: githubToken });
    const rawFiles = await fetchRepoFiles(octokit, owner, repo);

    if (Object.keys(rawFiles).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No recognized config files found in this repository (tried: package.json, requirements.txt, pyproject.toml, README.md, Cargo.toml, go.mod)' },
        { status: 404 }
      );
    }

    // Parse with Gemini
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await generateWithFallback(genai, buildManifestPrompt(rawFiles));

    const rawText = result.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: 'Gemini returned an unparseable response' },
        { status: 500 }
      );
    }

    const parsedManifest: ParsedManifest = JSON.parse(jsonMatch[0]);

    // Check for existing manifest
    const { data: existing } = await supabase
      .from('manifests')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let manifest;
    if (existing) {
      const { data, error } = await supabase
        .from('manifests')
        .update({
          repo_url: repoUrl,
          repo_name: `${owner}/${repo}`,
          raw_files: rawFiles,
          parsed_manifest: parsedManifest,
        })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      manifest = data;
    } else {
      const { data, error } = await supabase
        .from('manifests')
        .insert({
          user_id: user.id,
          repo_url: repoUrl,
          repo_name: `${owner}/${repo}`,
          raw_files: rawFiles,
          parsed_manifest: parsedManifest,
        })
        .select()
        .single();
      if (error) throw error;
      manifest = data;
    }

    return NextResponse.json({ success: true, data: { manifest } });
  } catch (error) {
    console.error('[scan-repo] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
