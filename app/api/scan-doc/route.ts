import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';
import type { ParsedManifest } from '@/types';

async function generateWithFallback(genai: GoogleGenAI, prompt: string): Promise<{ text?: string }> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash-lite'];
  let lastError;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await genai.models.generateContent({ model, contents: prompt });
        return result;
      } catch (err: any) {
        lastError = err;
        console.warn(`[scan-doc] Model ${model} (Attempt ${attempt}/2) failed:`, err?.message);
        if (err?.status === 404) break;
        if (err?.status === 429 || err?.status === 503) {
          await new Promise(r => setTimeout(r, attempt * 1000));
          continue;
        }
        break;
      }
    }
  }

  if (process.env.GROQ_API_KEY) {
    const groqModels = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b'];
    for (const gModel of groqModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: gModel, messages: [{ role: 'user', content: prompt }] }),
        });
        if (res.ok) {
          const data = await res.json();
          return { text: data.choices[0]?.message?.content ?? '' };
        } else {
          const errText = await res.text();
          lastError = new Error(`Groq fallback failed: ${errText}`);
          if (res.status === 429) continue;
          break;
        }
      } catch (e) {
        lastError = e;
      }
    }
  }

  throw lastError;
}

function buildPromptFromText(content: string, extraDescription?: string): string {
  return `You are a senior software architect. Analyze the following project documentation and extract the technical stack.

PROJECT DOCUMENTATION:
\`\`\`
${content.slice(0, 8000)}
\`\`\`

${extraDescription ? `ADDITIONAL CONTEXT FROM USER:\n${extraDescription}\n` : ''}
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
- Infer all technologies from the description
- version can be empty string if unknown
- key_dependencies: include the most important packages/libraries mentioned
- If missing info, make reasonable inferences based on the stack mentioned`;
}

// Very basic PDF text extraction: extract readable ASCII text chunks
function extractTextFromBuffer(buffer: Buffer): string {
  const str = buffer.toString('latin1');
  // Extract text between BT (Begin Text) and ET (End Text) markers and also just grab readable strings
  const readable: string[] = [];
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 32 && c < 127) {
      current += str[i];
    } else {
      if (current.length > 3) readable.push(current.trim());
      current = '';
    }
  }
  if (current.length > 3) readable.push(current.trim());
  return readable.filter(s => s.length > 3).join(' ').slice(0, 8000);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const description = (formData.get('description') as string | null) ?? '';

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    let extractedText = '';

    if (ext === 'md' || ext === 'txt') {
      extractedText = await file.text();
    } else if (ext === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // Basic text extraction for PDF
      extractedText = extractTextFromBuffer(buffer);
      if (extractedText.length < 100) {
        return NextResponse.json({ success: false, error: 'Could not extract text from PDF. Try uploading a .md or .txt file instead.' }, { status: 400 });
      }
    } else if (ext === 'docx') {
      // DOCX is a ZIP — extract the word/document.xml inside it
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      // Try to find XML content inside DOCX
      const xmlStr = buffer.toString('latin1');
      const xmlMatch = xmlStr.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
      if (xmlMatch) {
        extractedText = xmlMatch
          .map(m => m.replace(/<[^>]+>/g, ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      if (extractedText.length < 100) {
        return NextResponse.json({ success: false, error: 'Could not extract text from DOCX. Try uploading .md or .txt instead.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported file type. Please upload .md, .txt, .pdf, or .docx' }, { status: 400 });
    }

    if (description) {
      extractedText += '\n\n' + description;
    }

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const result = await generateWithFallback(genai, buildPromptFromText(extractedText, description));

    const rawText = result.text ?? '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'Could not parse tech stack from document' }, { status: 500 });
    }

    const parsedManifest: ParsedManifest = JSON.parse(jsonMatch[0]);
    const repoName = fileName.replace(/\.[^.]+$/, ''); // Use filename without extension as project name

    // Check for existing manifest with same name
    const { data: existing } = await supabase
      .from('manifests')
      .select('id')
      .eq('user_id', user.id)
      .eq('repo_name', repoName)
      .maybeSingle();

    let manifest;
    if (existing) {
      const { data, error } = await supabase
        .from('manifests')
        .update({ repo_url: '', repo_name: repoName, raw_files: { [fileName]: extractedText.slice(0, 5000) }, parsed_manifest: parsedManifest })
        .eq('id', existing.id).select().single();
      if (error) throw error;
      manifest = data;
    } else {
      const { data, error } = await supabase
        .from('manifests')
        .insert({ user_id: user.id, repo_url: '', repo_name: repoName, raw_files: { [fileName]: extractedText.slice(0, 5000) }, parsed_manifest: parsedManifest })
        .select().single();
      if (error) throw error;
      manifest = data;
    }

    return NextResponse.json({ success: true, data: { manifest } });
  } catch (error) {
    console.error('[scan-doc] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
