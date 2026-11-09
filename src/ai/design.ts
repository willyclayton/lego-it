import { COLORS } from '../lego/colors';
import { compileProgram, type ShapeProgram, type ShapeSpec } from '../lego/shapes';
import { assemble } from '../lego/steps';
import type { Model } from '../lego/types';
import type { ModelSize } from './models';

/**
 * Shared by both generation paths (the viewer's Claude account when hosted on
 * claude.ai, or a user-supplied API key elsewhere): the design instructions,
 * the shape-program JSON schema, and the clean-up that turns Claude's answer
 * into a buildable model. No SDK import here, so the hosted path stays light.
 */

export const SIZE_STUDS: Record<ModelSize, number> = { small: 16, medium: 26, large: 36 };

const COLOR_ENUM = [...Object.keys(COLORS), 'none'];

export const SHAPE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'features', 'parts'],
  properties: {
    title: { type: 'string', description: 'Short display name for the model' },
    description: { type: 'string', description: 'One sentence tagline' },
    features: {
      type: 'array',
      items: { type: 'string' },
      description: 'The 4-8 features that make the subject recognizable, most important first',
    },
    parts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'shape', 'op', 'center', 'size', 'rot', 'taper', 'color', 'mirror_x'],
        properties: {
          label: { type: 'string' },
          shape: { type: 'string', enum: ['box', 'ellipsoid', 'cylinder', 'wedge', 'torus'] },
          op: { type: 'string', enum: ['add', 'subtract', 'paint'] },
          center: { type: 'array', items: { type: 'number' }, description: '[x, y, z] in studs' },
          size: { type: 'array', items: { type: 'number' }, description: '[width x, height y, depth z] full extents in studs' },
          rot: { type: 'array', items: { type: 'number' }, description: '[rx, ry, rz] Euler degrees (XYZ)' },
          taper: { type: 'number', description: 'Top size relative to bottom along local y. 1 = none, 0 = point' },
          color: { type: 'string', enum: COLOR_ENUM },
          mirror_x: { type: 'boolean', description: 'Also add a copy mirrored across x = 0' },
        },
      },
    },
  },
} as const;

export function systemPrompt(size: ModelSize) {
  const n = SIZE_STUDS[size];
  return `You are a master LEGO designer. You design brick models as an ordered list of solid 3D shapes; a program then voxelizes the shapes at LEGO resolution (1 x 1 stud footprint, 1 plate tall) and converts them into real bricks, plates and slopes with building instructions.

Coordinate system (all values in studs; 1 stud = 8 mm, 1 plate = 0.4 stud, 1 brick = 1.2 studs):
- y is up and y = 0 is the table. Nothing may go below y = 0.
- x = 0, z = 0 is the model's center line. The model's FRONT faces +z; +x is the viewer's right when looking at the front.
- Target size: about ${n} studs along the longest side. Keep everything within ±${Math.round(n * 0.75)} studs of the center.

Shapes (center = middle of the shape, size = full extents [x, y, z] before rotation):
- box; ellipsoid; cylinder (axis along local y; a short wide cylinder is a disc); wedge (full height at local -z, sloping down to nothing at local +z); torus (ring in the local x-z plane, tube thickness = size y).
- taper scales the top end of a box or cylinder (0 = cone or pyramid, 1 = none).
- rot rotates the shape [rx, ry, rz] in degrees. A cylinder lying along z is rot [90, 0, 0] (its local top then points to +z).
- op: "add" fills with a color, "subtract" carves (color "none"), "paint" recolors only already-filled cells. Ops apply in order: build the big masses first, then subtract cut-outs, then paint color details (windows, stripes, eyes, markings).
- mirror_x adds a mirrored copy across x = 0. Use it for every symmetric pair (wings, legs, wheels, eyes).

Design rules:
- First decide the features that make the subject instantly recognizable, and spend your detail budget on those. The silhouette from a 3/4 front view matters most; exaggerate signature features by 20-50%.
- Anything that must read should be at least 2 studs wide and 2 plates (0.8 studs) thick, or it disappears at this resolution.
- Use 2-4 main colors plus a few accent colors. Transparent colors are good for glass, lights and engine glow.
- Every part must touch the rest of the model, and the model must stand on the table (legs, wheels, a base or a flat bottom). For flying or floating things, add a simple stand or base.
- Use 15-80 shapes. Prefer fewer, well-placed shapes over many tiny ones.
- Available colors: ${Object.values(COLORS)
    .map((c) => `${c.key} (${c.name})`)
    .join(', ')}.`;
}

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const vec = (v: unknown, d: [number, number, number]): [number, number, number] =>
  Array.isArray(v) ? [num(v[0], d[0]), num(v[1], d[1]), num(v[2], d[2])] : d;

/** Clamp and clean whatever came back so the voxelizer can't blow up. */
export function sanitizeProgram(raw: unknown, size: ModelSize): ShapeProgram {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lim = SIZE_STUDS[size] * 1.2;
  const parts: ShapeSpec[] = [];
  for (const p of Array.isArray(r.parts) ? r.parts.slice(0, 160) : []) {
    const q = p as Record<string, unknown>;
    const shape = ['box', 'ellipsoid', 'cylinder', 'wedge', 'torus'].includes(q.shape as string) ? (q.shape as ShapeSpec['shape']) : 'box';
    const op = ['add', 'subtract', 'paint'].includes(q.op as string) ? (q.op as ShapeSpec['op']) : 'add';
    const c = vec(q.center, [0, 1, 0]).map((v) => Math.max(-lim, Math.min(lim, v))) as [number, number, number];
    c[1] = Math.max(0, c[1]);
    const s = vec(q.size, [2, 1.2, 2]).map((v) => Math.max(0.2, Math.min(lim * 2, Math.abs(v)))) as [number, number, number];
    parts.push({
      label: String(q.label ?? shape),
      shape,
      op,
      center: c,
      size: s,
      rot: vec(q.rot, [0, 0, 0]),
      taper: Math.max(0, Math.min(3, num(q.taper, 1))),
      color: String(q.color ?? 'lbg'),
      mirror_x: Boolean(q.mirror_x),
    });
  }
  return {
    title: String(r.title ?? 'My Model').slice(0, 60),
    description: String(r.description ?? '').slice(0, 200),
    features: Array.isArray(r.features) ? r.features.map(String).slice(0, 10) : [],
    parts,
  };
}

export function programToModel(program: ShapeProgram, prompt: string): Model {
  const placements = compileProgram(program, { slopes: true });
  if (placements.length === 0) throw new Error('The design came out empty. Try rephrasing your idea.');
  const n = placements.length;
  const difficulty = (n < 40 ? 1 : n < 120 ? 2 : n < 300 ? 3 : n < 600 ? 4 : 5) as Model['difficulty'];
  return assemble(
    {
      id: `gen-${Date.now()}`,
      name: program.title || prompt,
      tagline: program.description || `Designed from “${prompt}”.`,
      difficulty,
      age: ['6+', '7+', '9+', '12+', '16+'][difficulty - 1],
      maxPerStep: n < 60 ? 4 : n < 250 ? 6 : 9,
      heroView: 35,
      generated: true,
    },
    placements,
  );
}

/** One self-contained prompt for hosts that have no system prompt (the hosted `sample` path). */
export function hostedPrompt(size: ModelSize, idea: string) {
  return `${systemPrompt(size)}

Output format: reply with only one JSON object, no other text, shaped like this example (values are illustrative):
{"title":"Rubber Duck","description":"A bath-time classic.","features":["round body","orange beak","tail"],"parts":[
 {"label":"body","shape":"ellipsoid","op":"add","center":[0,2.4,0],"size":[8,4.8,10],"rot":[0,0,0],"taper":1,"color":"yellow","mirror_x":false},
 {"label":"eye","shape":"box","op":"paint","center":[1.5,5.6,3.5],"size":[1,0.8,1],"rot":[0,0,0],"taper":1,"color":"black","mirror_x":true}]}
Every part needs all nine fields. "shape" is one of box, ellipsoid, cylinder, wedge, torus; "op" is add, subtract or paint; "color" is one of the color keys listed above, or "none" for subtract.

Design a LEGO model of: ${idea}`;
}
