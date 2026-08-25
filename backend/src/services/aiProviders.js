const fetch = require('node-fetch');

const KEY_BY_PROVIDER = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  groq: process.env.GROQ_API_KEY,
  gemini: process.env.GEMINI_API_KEY,
};

async function callAnthropic({ apiKey, model, maxTokens, temperature, system, userMessage }) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens || 1000,
      temperature: temperature ?? 0.7,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'Anthropic API error');
  return (data.content || []).map((c) => c.text || '').join('').trim();
}

async function callOpenAICompatible({ endpoint, apiKey, model, maxTokens, temperature, system, userMessage }) {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens || 1000,
      temperature: temperature ?? 0.7,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'API error');
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

async function callGemini({ apiKey, model, maxTokens, temperature, system, userMessage }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens || 1000, temperature: temperature ?? 0.7 },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'Gemini API error');
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
}

async function callOllama({ endpoint, model, temperature, system, userMessage }) {
  const resp = await fetch(endpoint || 'http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || 'llama3.2',
      stream: false,
      options: { temperature: temperature ?? 0.7 },
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error || 'Ollama error — is it running?');
  return data?.message?.content?.trim() || '';
}

const OPENAI_COMPATIBLE_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
};

async function callProvider(settings, userMessage, systemPrompt, kbContext) {
  const provider = settings?.provider || 'anthropic';
  const system = (systemPrompt || '') + (kbContext ? `\n\nContext:\n${kbContext.slice(0, 4000)}` : '');
  const maxTokens = settings?.maxTokens || 1000;
  const temperature = settings?.temperature ?? 0.7;
  const model = settings?.model;

  if (provider === 'builtin') {
    throw new Error('The built-in demo model runs in the browser; it should not call the backend.');
  }

  if (provider === 'ollama') {
    return callOllama({ endpoint: settings?.endpoint, model, temperature, system, userMessage });
  }

  const apiKey = KEY_BY_PROVIDER[provider];
  if (!apiKey && provider !== 'custom') {
    throw new Error(`No ${provider.toUpperCase()}_API_KEY configured on the backend (.env)`);
  }

  if (provider === 'anthropic') {
    return callAnthropic({ apiKey, model, maxTokens, temperature, system, userMessage });
  }
  if (provider === 'gemini') {
    return callGemini({ apiKey, model, maxTokens, temperature, system, userMessage });
  }
  if (OPENAI_COMPATIBLE_ENDPOINTS[provider]) {
    return callOpenAICompatible({
      endpoint: OPENAI_COMPATIBLE_ENDPOINTS[provider],
      apiKey,
      model,
      maxTokens,
      temperature,
      system,
      userMessage,
    });
  }
  if (provider === 'custom') {
    return callOpenAICompatible({
      endpoint: settings?.endpoint,
      apiKey: settings?.apiKey || '',
      model,
      maxTokens,
      temperature,
      system,
      userMessage,
    });
  }
  throw new Error(`Unsupported provider: ${provider}`);
}

module.exports = { callProvider };
