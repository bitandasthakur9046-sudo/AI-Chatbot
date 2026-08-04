# Groq AI Chatbot

A production-ready, beginner-friendly AI chatbot powered by [Groq](https://groq.com)'s
ultra-fast inference API. Streaming responses, conversation history, clean UI,
zero build tools.

```
groq-chatbot/
├── backend/
│   ├── server.js        # Express server + Groq API integration
│   ├── package.json
│   ├── .env.example     # copy to .env and add your key
│   └── .gitignore
├── frontend/
│   ├── index.html       # chat UI structure
│   ├── style.css        # modern responsive styling
│   └── script.js        # streaming fetch logic + state
└── README.md
```

---

## 1. Prerequisites

- **Node.js 18+** installed (check with `node -v`). Get it from [nodejs.org](https://nodejs.org) if needed.
- A **free Groq API key**: sign up at [console.groq.com](https://console.groq.com) → "API Keys" → "Create API Key". No credit card needed for the free tier.

---

## 2. Setup (5 minutes)

```bash
# 1. Go into the backend folder
cd groq-chatbot/backend

# 2. Install dependencies
npm install

# 3. Create your environment file
cp .env.example .env

# 4. Open .env and paste your real key:
#    GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxx

# 5. Start the server
npm start
```

You should see:
```
✅ Groq chatbot server running at http://localhost:3000
   Using model: openai/gpt-oss-120b
```

Open **http://localhost:3000** in your browser. That's it — the same server
serves both the API and the chat UI, so there's nothing else to run.

Use `npm run dev` instead of `npm start` during development — it auto-restarts
the server whenever you save a file (uses Node's built-in `--watch`).

---

## 3. How it works (the short version)

1. **You type a message** → the frontend adds it to a `conversation` array and sends the *whole array* to `POST /api/chat`. Sending full history each time is what gives the bot "memory" of the conversation — the model itself is stateless.
2. **The backend** validates the request, prepends a system prompt (the bot's personality), and calls Groq with `stream: true`.
3. **Groq streams tokens back** as they're generated. The backend forwards each token to the browser immediately using chunked HTTP responses — it doesn't wait for the full answer.
4. **The frontend reads the stream** via `response.body.getReader()` and appends each chunk to the message bubble live, producing the "typing" effect.
5. Once done, the full reply is saved into the conversation array and into `localStorage`, so refreshing the page keeps your history.

---

## 4. Testing it

**Manual test (recommended for a chatbot):**
1. Send "Hello, who are you?" — you should see a typing indicator, then streamed text.
2. Send a follow-up like "What did I just ask you?" — confirms conversation memory works.
3. Click **Clear** — confirms history resets.
4. Refresh the page mid-conversation — confirms `localStorage` persistence.

**API test with curl** (server must be running):
```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hi in 5 words"}]}'
```
The `-N` flag disables curl's output buffering so you can watch tokens stream in.

**Health check:**
```bash
curl http://localhost:3000/api/health
```

---

## 5. Debugging common issues

| Symptom | Cause | Fix |
|---|---|---|
| Server won't start, "Missing GROQ_API_KEY" | `.env` missing or empty | Run `cp .env.example .env` and paste your key |
| `401` error in the browser | Invalid/expired API key | Regenerate a key at console.groq.com/keys |
| `429 Too many requests` | Hit the built-in rate limiter (20 req/min) or Groq's own rate limit | Wait a minute, or raise `RATE_LIMIT` in `server.js` |
| Chat bubble stays empty forever | Model name deprecated/invalid | Check current models at console.groq.com/docs/models, update `GROQ_MODEL` in `.env` |
| CORS error in console | Frontend served from a different origin than backend | Keep using `http://localhost:3000` for both (this project serves both from one server) — don't open `index.html` directly via `file://` |
| Changes to server.js not taking effect | Server still running old code | Stop it (Ctrl+C) and restart, or use `npm run dev` |

**Server-side errors** always print to your terminal (`console.error(...)` in `server.js`) — check there first.

---

## 6. Customizing

- **Bot personality:** edit `systemMessage.content` in `server.js`.
- **Model:** set `GROQ_MODEL` in `.env` (see [console.groq.com/docs/models](https://console.groq.com/docs/models) for current options — Groq updates these periodically).
- **Colors/theme:** edit the CSS variables at the top of `style.css`.
- **History length sent to model:** change `messages.slice(-20)` in `server.js`.
- **Rate limit:** adjust `RATE_LIMIT` / `RATE_WINDOW_MS` in `server.js`.

---

## 7. Deployment

This project is pre-configured to host out-of-the-box on **Netlify** (via Netlify Functions & static hosting) and **Render** (via Express Web Service / Blueprint).

---

### Option A: Netlify Hosting (Serverless)

Netlify hosts the frontend statically and handles backend API calls (`/api/chat`, `/api/health`) via Netlify Serverless Functions with token streaming support.

1. **Push your project to GitHub / GitLab / Bitbucket**.
2. Log into [Netlify](https://app.netlify.com) and click **"Add new site" → "Import an existing project"**.
3. Connect your repository. Netlify automatically detects `netlify.toml`:
   - **Publish directory:** `frontend`
   - **Functions directory:** `netlify/functions`
4. Go to **Site configuration → Environment variables** and add:
   - `GROQ_API_KEY`: `your_groq_api_key_here`
   - *(Optional)* `GROQ_MODEL`: `openai/gpt-oss-120b`
5. Click **Deploy site**. Netlify gives you a public URL (e.g. `https://your-chatbot.netlify.app`).

---

### Option B: Render Hosting (Node / Express Web Service)

Render hosts the Express backend and frontend together as a Node Web Service.

1. **Push your project to GitHub**.
2. Log into [Render](https://dashboard.render.com).
3. Click **New + → Blueprint** (or **Web Service**):
   - **Blueprint (1-Click):** Connect your repo. Render automatically reads `render.yaml`. Fill in `GROQ_API_KEY` when prompted and click **Apply**.
   - **Web Service (Manual):**
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - Under **Environment Variables**, add `GROQ_API_KEY`.
4. Click **Create Web Service**. Render gives you a public URL (e.g. `https://groq-chatbot.onrender.com`).

---

### Option C: Netlify Frontend + Render Backend

If you prefer hosting the static frontend on Netlify's CDN and the backend API on Render:
1. Deploy the backend on Render as a Web Service (Option B).
2. In `netlify.toml`, update the redirect rule to point to your Render backend:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-render-app.onrender.com/api/:splat"
     status = 200
     force = true
   ```
3. Deploy the frontend repository to Netlify.

---

### Before deploying, double-check:
- [ ] `.env` is in `.gitignore` (it is, by default) — **never** commit your API key.
- [ ] `GROQ_API_KEY` is added to your hosting environment variables.
- [ ] `npm install` runs cleanly without errors.


---

## 8. Best practices already built in

- ✅ API key stays server-side only, never exposed to the browser.
- ✅ Input validation on every request (shape, type, emptiness).
- ✅ Basic per-IP rate limiting to protect your Groq bill.
- ✅ Startup validation — fails fast with a clear message if misconfigured.
- ✅ Conversation history trimmed before sending to the model (cost/latency control).
- ✅ Graceful error handling on both frontend and backend, with user-visible messages instead of silent failures or stuck spinners.
- ✅ Streaming responses for a responsive, modern feel.

### Natural next steps if you keep building
- Swap the in-memory rate limiter for `express-rate-limit` + Redis for real production traffic.
- Add user authentication if you need per-user chat history instead of one shared browser's `localStorage`.
- Add a proper database (Postgres/SQLite) if you want history to survive across devices.
- Render markdown (e.g. with `marked.js`) in assistant replies instead of plain text, since the system prompt already asks the model to use markdown.
