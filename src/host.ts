import { strToU8, zipSync } from 'fflate';

/**
 * Where is the app running? As a hosted claude.ai page, the viewer grants
 * capabilities through `window.claude.use(name)`:
 *   - `sample`: ask Claude on the viewer's own account (powers "Build anything")
 *   - `downloads`: offer a generated file through a save prompt
 * Elsewhere (local dev, any static host) the app uses plain browser APIs and
 * an optional user-supplied API key instead.
 */

export interface SampleFn {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string; truncated: boolean }>;
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>;
}
interface DownloadsNS {
  save(req: { filename: string; data: string | Blob | ArrayBuffer | ArrayBufferView }): Promise<{ status: string }>;
}
interface ClaudeHost {
  use(name: string): Promise<unknown>;
}

const claudeHost = (): ClaudeHost | null => {
  const c = (window as unknown as { claude?: ClaudeHost }).claude;
  return c && typeof c.use === 'function' ? c : null;
};

/** True when running inside a claude.ai artifact viewer. */
export const inArtifact = !!claudeHost();

let samplePromise: Promise<SampleFn | null> | null = null;
let downloadsPromise: Promise<DownloadsNS | null> | null = null;

export function getSample(): Promise<SampleFn | null> {
  const c = claudeHost();
  if (!c) return Promise.resolve(null);
  samplePromise ??= c.use('sample').then((s) => (s as SampleFn) ?? null).catch(() => null);
  return samplePromise;
}

function getDownloads(): Promise<DownloadsNS | null> {
  const c = claudeHost();
  if (!c) return Promise.resolve(null);
  downloadsPromise ??= c.use('downloads').then((d) => (d as DownloadsNS) ?? null).catch(() => null);
  return downloadsPromise;
}

/** File types the hosted save prompt accepts. Anything else is zipped first. */
const HOST_EXT = new Set('gif png jpg jpeg webp mp4 webm mov txt json md docx pptx epub csv ttf html svg pdf xlsx zip fig'.split(' '));

export type SaveOutcome = 'saved' | 'declined' | 'unavailable';

/** Save a generated file: through the host's save prompt when hosted, a plain download otherwise. */
export async function saveFile(filename: string, data: string | Blob): Promise<SaveOutcome> {
  if (!inArtifact) {
    const blob = typeof data === 'string' ? new Blob([data], { type: 'text/plain' }) : data;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'saved';
  }
  const dl = await getDownloads();
  if (!dl) return 'unavailable';
  let name = filename;
  let payload: string | Blob | Uint8Array = data;
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (!HOST_EXT.has(ext)) {
    // e.g. .ldr and .xml: wrap the file in a zip so it can be saved
    const bytes = typeof data === 'string' ? strToU8(data) : new Uint8Array(await data.arrayBuffer());
    payload = zipSync({ [filename]: bytes });
    name = filename.replace(/\.[^.]+$/, '') + '.zip';
  }
  try {
    await dl.save({ filename: name, data: payload });
    return 'saved';
  } catch (e) {
    const code = (e as { code?: string })?.code;
    return code === 'declined' || code === 'rate_limited' ? 'declined' : 'unavailable';
  }
}

/** Printing is refused inside the hosted viewer. */
export const canPrint = !inArtifact;
