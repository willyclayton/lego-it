import type { SampleFn } from '../host';
import type { ShapeProgram } from '../lego/shapes';
import type { Model } from '../lego/types';
import { hostedPrompt, programToModel, sanitizeProgram } from './design';
import type { ModelSize } from './models';

/**
 * "Build anything" on a claude.ai-hosted page: ask Claude through the viewer's
 * own account (the `sample` capability). No API key; the viewer is asked to
 * allow it on first use.
 */
export async function generateHosted(
  sample: SampleFn,
  opts: { prompt: string; size: ModelSize; signal?: AbortSignal; onProgress?: (msg: string) => void },
): Promise<{ model: Model; program: ShapeProgram }> {
  opts.onProgress?.('Designing the shape… (allow Lego It to use Claude if asked)');
  let raw: unknown;
  try {
    raw = await sample.json(hostedPrompt(opts.size, opts.prompt), {
      modelTier: 'complex',
      signal: opts.signal,
      onText: ({ text }: { text: string }) => opts.onProgress?.(`Placing shapes… (${Math.round(text.length / 1000)}k characters)`),
    });
  } catch (e) {
    throw new Error(hostedError(e));
  }
  opts.onProgress?.('Converting to bricks…');
  await new Promise((r) => setTimeout(r, 30));
  const program = sanitizeProgram(raw, opts.size);
  return { model: programToModel(program, opts.prompt), program };
}

function hostedError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  switch (code) {
    case 'cancelled':
      return 'Cancelled.';
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return 'Claude isn’t available to this page in your account, so only the built-in samples can be shown.';
    case 'rate_limited':
      return 'You’ve hit a usage limit. Try again in a little while.';
    case 'session_expired':
      return 'Your Claude session expired. Sign in again, then retry.';
    case 'refused':
      return 'Claude declined to design this one. Try a different idea.';
    case 'invalid_json':
    case 'empty_completion':
      return 'The design came back incomplete. Try again, or pick a smaller size.';
    default:
      return 'Something went wrong reaching Claude. Try again.';
  }
}
