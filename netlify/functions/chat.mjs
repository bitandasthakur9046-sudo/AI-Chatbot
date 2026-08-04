import Groq from 'groq-sdk';

const requestLog = new Map();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return timestamps.length > RATE_LIMIT;
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing GROQ_API_KEY environment variable. Please configure it in Netlify Site Settings.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const clientIP = req.headers.get('client-ip') || req.headers.get('x-forwarded-for') || 'unknown';
  if (isRateLimited(clientIP)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please slow down and try again shortly.' }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Request must include a non-empty "messages" array.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const isValidShape = messages.every(
    (m) =>
      m &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0 &&
      ['user', 'assistant'].includes(m.role)
  );

  if (!isValidShape) {
    return new Response(
      JSON.stringify({
        error: 'Each message needs a role of "user" or "assistant" and non-empty string content.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const recentHistory = messages.slice(-20);
  const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const groq = new Groq({ apiKey });

  try {
    const stream = await groq.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful, friendly AI assistant in a chat app. Give clear, ' +
            'concise answers. Use markdown formatting (like **bold** or lists) when it improves readability.',
        },
        ...recentHistory,
      ],
      temperature: 0.7,
      max_tokens: 1024,
      stream: true,
    });

    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
              controller.enqueue(encoder.encode(token));
            }
          }
        } catch (err) {
          console.error('Groq stream processing error:', err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('Netlify Chat Function Error:', err);
    return new Response(
      JSON.stringify({
        error:
          err?.status === 401
            ? 'Invalid Groq API key configured on Netlify.'
            : 'Something went wrong talking to the AI. Please try again.',
      }),
      {
        status: err?.status === 401 ? 401 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
