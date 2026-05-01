# StackShadow

StackShadow is an autonomous, multi-agent "Shadow CTO" that seamlessly integrates into your GitHub repositories to provide continuous threat intelligence, landscape monitoring, and dependency analysis. Built for non-technical founders and agile startup teams, StackShadow ensures your tech stack remains secure, modern, and cost-effective without needing a dedicated security or DevOps team.

## 🌟 Key Features
- **Zero-Config Integration**: Link your GitHub repo and let the agents do the rest.
- **Autonomous Threat Intelligence**: Continuous scanning against global vulnerability databases (OSV, GitHub Advisories).
- **Tech Landscape Monitoring**: Stay ahead of framework deprecations, licensing changes, and new AI model pricing.
- **Actionable Insights**: Non-technical summaries of what broke, why it matters, and how to fix it.

## 🤖 The Google AI Stack (Gemini Integration)
StackShadow is powered heavily by the **Google AI Stack**, utilizing the `@google/genai` SDK and the `gemini-2.5-flash` model to power a suite of specialized, autonomous agents.

### 1. The Manifest Builder (`scan-repo`)
When a user links a GitHub repository, StackShadow fetches critical infrastructure and dependency files (`package.json`, `requirements.txt`, `docker-compose.yml`, `build.gradle`, etc.). 
- **Google AI Usage:** The raw file contents are passed to `gemini-2.5-flash`, which is instructed to act as a Senior Software Architect. Gemini analyzes the files and synthesizes a structured JSON "Tech Manifest," categorizing the repository into Languages, Frameworks, Key Dependencies, Databases, Infrastructure, and AI Models.

### 2. The Fuzzer Agent (`run-fuzzer`)
The Fuzzer Agent continuously queries global vulnerability databases against the startup's Tech Manifest.
- **Google AI Usage (Prompt Batching):** To achieve extreme efficiency, the agent batches all raw vulnerability data into a massive JSON payload and sends a single prompt to `gemini-2.5-flash`. Gemini acts as a strict security advisor, filtering out false positives (e.g., verifying if the specific version is out of the vulnerable range) and generating non-expert summaries for valid threats.

### 3. The Landscape Scraper Agent (`run-scraper`)
The Scraper Agent monitors the broader tech ecosystem for deprecations, licensing changes, and better alternatives.
- **Google AI Usage:** It uses the Tavily API to search the web for recent news regarding the startup's stack. The raw web context is fed into `gemini-2.5-flash`, which cross-references the news against the startup's specific versions to identify actionable intelligence (e.g., "Next.js 15 is out, here is why you should upgrade").

### Robust Fallback System
To ensure 100% uptime, StackShadow implements an exponential backoff retry system for Gemini's `503 High Demand` errors, and seamlessly falls back to a Groq LLaMA 3.3 integration if Google API rate limits (`429 Resource Exhausted`) are hit.

## 🗄️ Database & Authentication (Supabase)
StackShadow uses **Supabase** (PostgreSQL) for its backend infrastructure:
- **Authentication**: Seamless Google OAuth integration for frictionless onboarding.
- **Data Storage**: Stores user profiles, linked repositories, generated Tech Manifests, and historical agent scans.
- **Security**: Secured with strict Row Level Security (RLS) policies to ensure users can only access their own repository intelligence.

## 💻 How to Run Locally

### Prerequisites
1. Node.js (v18+)
2. A Supabase project (for Authentication & PostgreSQL)
3. API Keys: Google Gemini, Tavily, GitHub (PAT), and Groq.

### Setup
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in your keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="..."
   NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   GEMINI_API_KEY="..."
   TAVILY_API_KEY="..."
   GITHUB_TOKEN="..."
   GROQ_API_KEY="..."
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## 🚀 Deployment Guide

StackShadow is fully compatible with both Google Cloud Run and Vercel. Because of the heavy background processing of the AI Agents, **Google Cloud Run** is the recommended deployment target.

### Option A: Google Cloud Run (Recommended)
Google Cloud Run automatically builds the Next.js application from source using Buildpacks—no Dockerfile required.
1. In the Google Cloud Console, navigate to **Cloud Run** and create a new service.
2. Select **Continuously deploy from a repository** and link your GitHub repository.
3. For Build Type, select **Buildpacks** (`Go, Node.js, Python, Java... via Google Cloud's buildpacks`).
4. Under **Containers > Variables & Secrets**, add all of your `.env` variables.
5. *Note on Build Variables*: Ensure your `NEXT_PUBLIC_` variables are also added to the Cloud Build trigger environment, or temporarily hardcoded in `next.config.ts` so they are available at build time.

### Option B: Vercel
1. Connect your GitHub repository to Vercel.
2. Add all environment variables in the Vercel project settings.
3. In your Supabase Dashboard, ensure you update **Authentication > URL Configuration > Site URL** to your Vercel domain to prevent `localhost` redirects.
4. Deploy.

---
*Built for the Google AI Hackathon. *