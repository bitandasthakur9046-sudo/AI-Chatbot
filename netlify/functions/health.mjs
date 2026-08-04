export default async (req, context) => {
  const MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  return new Response(
    JSON.stringify({ status: 'ok', model: MODEL, platform: 'netlify' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
