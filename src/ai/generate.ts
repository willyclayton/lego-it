import Anthropic from '@anthropic-ai/sdk';
import type { ShapeProgram } from '../lego/shapes';
import type { Model } from '../lego/types';
import { programToModel, sanitizeProgram, SHAPE_SCHEMA, systemPrompt } from './design';
import { DEFAULT_MODEL, type ModelSize } from './models';

/**
 * "LEGO anything": Claude designs the model as a list of solid shapes (a shape
 * program), and the same voxel → brick → steps pipeline used by the built-in
 * samples turns it into a buildable model with instructions.
 *
 * The browser calls the API directly with the user's own key
 * (dangerouslyAllowBrowser). The key never leaves the browser except to
 * api.anthropic.com.
 */

export interface GenerateOpts {
  apiKey: string;
  prompt: string;
  size: ModelSize;
  model?: string;
  signal?: AbortSignal;
  onProgress?: (msg: string) => void;
}

export async function generateModel(opts: GenerateOpts): Promise<{ model: Model; program: ShapeProgram }> {
  try {
    return await runGeneration(opts);
  } catch (e) {
    if (opts.signal?.aborted) throw e;
    throw new Error(describeError(e));
  }
}

async function runGeneration(opts: GenerateOpts): Promise<{ model: Model; program: ShapeProgram }> {
  const client = new Anthropic({ apiKey: opts.apiKey, dangerouslyAllowBrowser: true });
  opts.onProgress?.('Designing the shape…');
  const stream = client.beta.messages.stream(
    {
      model: opts.model ?? DEFAULT_MODEL,
      max_tokens: 32000,
      // Opus 5.5 defaults to medium effort; this is a design task, so ask for more.
      output_config: { effort: 'high', format: { type: 'json_schema', schema: SHAPE_SCHEMA as unknown as Record<string, unknown> } },
      // Re-run on a fallback model automatically if a safety classifier declines.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(opts.size),
      messages: [{ role: 'user', content: `Design a LEGO model of: ${opts.prompt}` }],
    },
    { signal: opts.signal },
  );
  let chars = 0;
  stream.on('text', (delta) => {
    chars += delta.length;
    if (chars % 400 < delta.length) opts.onProgress?.(`Placing shapes… (${Math.round(chars / 1000)}k characters)`);
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to design this one. Try a different idea.');
  if (msg.stop_reason === 'max_tokens') throw new Error('The design was too long to finish. Try a simpler idea or a smaller size.');
  const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Could not read the design that came back. Please try again.');
  }
  opts.onProgress?.('Converting to bricks…');
  const program = sanitizeProgram(raw, opts.size);
  await new Promise((r) => setTimeout(r, 30));
  return { model: programToModel(program, opts.prompt), program };
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'That API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use that model.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited by the API. Wait a moment and try again.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach api.anthropic.com. Check your connection.';
  if (e instanceof Anthropic.APIError) return `API error ${e.status ?? ''}: ${e.message}`;
  if (e instanceof Error) return e.message;
  return String(e);
}
