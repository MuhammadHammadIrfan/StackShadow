# StackShadow

StackShadow is an autonomous, multi-agent "Shadow CTO" that seamlessly integrates into your GitHub repositories to provide continuous threat intelligence, landscape monitoring, and dependency analysis. Built for non-technical founders and agile startup teams, StackShadow ensures your tech stack remains secure, modern, and cost-effective without needing a dedicated security or DevOps team.

## The Google AI Stack (Gemini Integration)
StackShadow is powered heavily by the **Google AI Stack**, utilizing the `@google/genai` SDK and the `gemini-2.5-flash` model to power a suite of specialized, autonomous agents.

### 1. The Manifest Builder (`scan-repo`)
When a user links a GitHub repository, StackShadow fetches critical infrastructure and dependency files (`package.json`, `requirements.txt`, `docker-compose.yml`, `build.gradle`, etc.). 
- **Google AI Usage:** The raw file contents are passed to `gemini-2.5-flash`, which is instructed to act as a Senior Software Architect. Gemini analyzes the files and synthesizes a structured JSON "Tech Manifest," categorizing the repository into Languages, Frameworks, Key Dependencies, Databases, Infrastructure, and AI Models.

### 2. The Fuzzer Agent (`run-fuzzer`)
The Fuzzer Agent continuously queries global vulnerability databases (OSV.dev, GitHub Security Advisories) against the startup's Tech Manifest.
- **Google AI Usage (Prompt Batching):** To achieve extreme efficiency, the agent batches all raw vulnerability data into a massive JSON payload and sends a single prompt to `gemini-2.5-flash`. Gemini acts as a strict security advisor, filtering out false positives (e.g., verifying if the specific version is out of the vulnerable range) and generating non-expert summaries for valid threats.

### 3. The Landscape Scraper Agent (`run-scraper`)
The Scraper Agent monitors the broader tech ecosystem for deprecations, licensing changes, and better alternatives.
- **Google AI Usage:** It uses Tavily API to search the web for recent news regarding the startup's stack. The raw web context is fed into `gemini-2.5-flash`, which cross-references the news against the startup's specific versions to identify actionable intelligence (e.g., "Next.js 15 is out, here is why you should upgrade").

### Robust Fallback System
To ensure 100% uptime, StackShadow implements an exponential backoff retry system for Gemini's `503 High Demand` errors, and seamlessly falls back to a Groq LLaMA 3.3 integration if Google API rate limits (`429 Resource Exhausted`) are hit.

## How to Run Locally

### Prerequisites
1. Node.js (v18+)
2. A Supabase project (for Authentication & PostgreSQL)
3. API Keys: Google Gemini, Tavily, GitHub (PAT), and Groq.

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="..."
   NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   GEMINI_API_KEY="..."
   TAVILY_API_KEY="..."
   GITHUB_TOKEN="..."
   GROQ_API_KEY="..."
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Navigate to `http://localhost:3000` to link your first repository.
