import fs from 'fs';

function loadEnv() {
  const file = fs.readFileSync('.env', 'utf8');
  file.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length > 0 && !key.startsWith('#')) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  });
}

loadEnv();

async function checkGemini() {
  console.log('--- Checking Gemini Models ---');
  if (!process.env.GEMINI_API_KEY) {
    console.log('No GEMINI_API_KEY set in .env');
    return;
  }
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
    const data = await res.json();
    if (data.models) {
      data.models.forEach(m => {
         console.log(m.name);
      });
    } else {
        console.log('Gemini failed:', data);
    }
  } catch (err) {
    console.error('Error fetching Gemini models:', err);
  }
}

async function checkGroq() {
  console.log('\n--- Checking Groq Models ---');
  if (!process.env.GROQ_API_KEY) {
    console.log('No GROQ_API_KEY set in .env');
    return;
  }
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      data.data.forEach(m => console.log(`${m.id} (Context: ${m.context_window})`));
    } else {
      console.log('Groq models exact fail:', await res.text());
    }
  } catch (e) {
    console.error('Error fetching Groq models:', e.message);
  }
}

async function main() {
  await checkGemini();
  await checkGroq();
}

main();
