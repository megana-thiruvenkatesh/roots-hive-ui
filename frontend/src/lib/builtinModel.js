let pipelinePromise = null;
export let status = { state: 'idle', text: '' };

export function getBuiltinStatus() {
  return status;
}

async function getPipeline(onProgress) {
  if (!pipelinePromise) {
    status = { state: 'loading', text: 'Loading built-in AI model…' };
    pipelinePromise = import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2').then(async (mod) => {
      mod.env.allowLocalModels = false;
      const gen = await mod.pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat', {
        progress_callback: (p) => {
          if (p?.status === 'progress' && p.file) {
            const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
            status = { state: 'loading', text: `Downloading ${p.file} (${pct}%)…` };
            onProgress?.(status);
          }
        },
      });
      status = { state: 'ready', text: 'Ready' };
      return gen;
    });
  }
  return pipelinePromise;
}

export async function askBuiltinModel(userMessage, systemPrompt, kbContext, onProgress) {
  const generator = await getPipeline(onProgress);
  const sys =
    (systemPrompt || 'You are a helpful assistant.') +
    (kbContext ? `\n\nRelevant context:\n${kbContext.slice(0, 1800)}` : '');
  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: userMessage },
  ];
  const output = await generator(messages, {
    max_new_tokens: 260,
    temperature: 0.7,
    do_sample: true,
    top_k: 40,
  });
  const gt = output?.[0]?.generated_text;
  if (Array.isArray(gt)) return gt[gt.length - 1]?.content?.trim() || '';
  if (typeof gt === 'string') return gt.trim();
  return '';
}
