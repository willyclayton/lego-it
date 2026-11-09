/** Kept separate from generate.ts so the SDK is only downloaded when someone generates. */
export const DEFAULT_MODEL = 'claude-opus-5-5';
export const MODEL_OPTIONS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster)' },
];
export type ModelSize = 'small' | 'medium' | 'large';
