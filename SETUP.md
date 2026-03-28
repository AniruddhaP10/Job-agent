# JobAgent AI — Free Deployment Guide
## Netlify + Turso + Netlify Identity + Google Gemini (100% free)

---

## Overview — Everything is Free

| Service | What it does | Cost |
|---|---|---|
| Netlify | Hosts app + serverless functions | Free |
| Netlify Identity | User login / signup | Free (up to 1,000 users) |
| Turso | SQLite cloud database | Free (up to 500 databases) |
| Google Gemini API | Powers all AI + job search | **Free** (1M tokens/day) |

**Total monthly cost: $0**

---

## Step 1 — Get a Free Google Gemini API Key (3 min)

1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with any Google account
3. Click **"Create API key"**
4. Copy the key (starts with `AIza...`)
5. **Save it** — you'll need it in Step 4

> No credit card required. The free tier includes:
> - 1,000,000 tokens per day
> - 15 requests per minute
> - Google Search grounding (used for job searching)
> - PDF reading support

---

## Step 2 — Get a Free Turso Database (5 min)

**Option A — Web dashboard (no CLI):**
1. Go to **https://app.turso.tech** → Sign up free
2. Click **"Create Database"** → name it `job-agent` → choose any region
3. Click into your database → **"Connect"** tab
4. Copy the **Database URL** (starts with `libsql://`)
5. Click **"Generate Token"** → copy the token

**Option B — CLI:**
```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create job-agent
turso db show job-agent --url       # copy this
turso db tokens create job-agent    # copy this
```

---

## Step 3 — Deploy to Netlify via GitHub (5 min)

1. Push this project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/job-agent.git
git push -u origin main
```

2. Go to **https://netlify.com** → Sign up free → **"Add new site"** → **"Import from Git"**
3. Connect GitHub → select your repo
4. Build settings auto-detected from `netlify.toml`
5. Click **"Deploy site"**

---

## Step 4 — Add Environment Variables (2 min)

In Netlify dashboard → **Site settings** → **Environment variables** → **Add variable**:

| Key | Value | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | `AIza...` | Step 1 (Google AI Studio) |
| `TURSO_DATABASE_URL` | `libsql://...` | Step 2 (Turso dashboard) |
| `TURSO_AUTH_TOKEN` | `your-token` | Step 2 (Turso dashboard) |

After adding all three → **Deploys** → **Trigger deploy** → **Deploy site**

---

## Step 5 — Enable Netlify Identity (3 min)

1. Netlify dashboard → **Identity** (left sidebar)
2. Click **"Enable Identity"**
3. Under **Registration** → **"Invite only"** (for personal use) or **"Open"** (for others)
4. Optionally enable Google / GitHub login under **External providers**

---

## Step 6 — Test It

1. Visit your `https://your-site.netlify.app`
2. Sign in / create account
3. Upload a PDF resume → Parse Resume
4. Add job titles (e.g. "Frontend Engineer", "React Developer") → Find Jobs
5. Score your resume against any job description
6. Select jobs → generate cover letters → mark applied
7. Check Tracker — everything saves to your Turso database!

---

## Local Development

```bash
npm install -g netlify-cli
npm install
netlify login
netlify link      # link to your Netlify site
netlify dev       # runs at http://localhost:8888
```

Create `.env` file:
```
GEMINI_API_KEY=AIza...
TURSO_DATABASE_URL=libsql://job-agent-xxx.turso.io
TURSO_AUTH_TOKEN=your-token
```

---

## Free Tier Limits

| Resource | Free Limit | Typical Usage |
|---|---|---|
| Gemini tokens/day | 1,000,000 | ~500 job searches |
| Gemini requests/min | 15 | Plenty for personal use |
| Turso rows | 1 billion | Unlimited for tracking |
| Netlify bandwidth | 100 GB/month | Way more than needed |
| Netlify Identity users | 1,000 | More than enough |

---

## Project Structure

```
job-agent/
├── src/
│   ├── main.jsx
│   └── App.jsx
├── netlify/
│   └── functions/
│       ├── parse-resume.mjs   # Gemini reads PDF
│       ├── search-jobs.mjs    # Gemini + Google Search
│       ├── cover-letter.mjs   # Gemini writes letters
│       ├── score-resume.mjs   # Gemini scores fit
│       └── applications.mjs   # Turso CRUD
├── index.html
├── netlify.toml
├── package.json
├── vite.config.js
└── SETUP.md
```

---

## Troubleshooting

**"Unauthorized"** → Enable Netlify Identity and make sure you're logged in

**Gemini API error** → Check GEMINI_API_KEY is set correctly in Netlify env vars

**Jobs not found** → Google Search grounding needs a moment; try more specific titles

**Turso error** → URL must start with `libsql://` not `https://`

**Resume parse fails** → PDF must be text-based (not a scanned image)

**Functions not working** → Re-deploy after adding env vars; check Netlify Functions logs
