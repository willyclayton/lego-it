import * as THREE from 'three';
import type { Model } from '../lego/types';
import { BrickMesh, type RenderStyle } from './brickMesh';
import { partGeo, PLATE } from './geometry';
import { dirFromAngles, EL_DEFAULT, fitOrtho, makeLights } from './stage';

/**
 * Offscreen renderer for instruction pages, part callouts and thumbnails.
 * One WebGL context is shared by everything (browsers cap the number of contexts).
 */
class Offscreen {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  lights: ReturnType<typeof makeLights>;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 0);
    this.lights = makeLights(this.scene, this.renderer);
    this.lights.apply('instructions');
  }

  draw(obj: THREE.Object3D, w: number, h: number, style: RenderStyle = 'instructions') {
    this.lights.apply(style);
    this.renderer.toneMapping = style === 'realistic' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    this.renderer.setSize(Math.round(w), Math.round(h), false);
    this.scene.add(obj);
    this.renderer.render(this.scene, this.camera);
    this.scene.remove(obj);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

let off: Offscreen | null = null;
const offscreen = () => (off ??= new Offscreen());

/* ------------------------------ part images ------------------------------ */

export interface PartImage {
  url: string;
  w: number; // CSS px at scale 1
  h: number;
}

const partCache = new Map<string, PartImage>();
const partMeshes = new Map<string, BrickMesh>();

/**
 * Render a single part at a fixed pixel-per-stud scale so all callout images share
 * one scale (a 2x4 really looks twice as long as a 2x2, like in the manuals).
 */
export function partImage(partId: string, color: string, pxPerStud = 22, az = 35, el = EL_DEFAULT): PartImage {
  const k = `${partId}|${color}|${pxPerStud}|${az}|${el}`;
  const hit = partCache.get(k);
  if (hit) return hit;
  const o = offscreen();
  const mk = `${partId}|${color}`;
  let mesh = partMeshes.get(mk);
  if (!mesh) {
    mesh = new BrickMesh([{ part: partId, color, x: 0, y: 0, z: 0, rot: 0 }]);
    mesh.setAll(0);
    mesh.setStyle('instructions');
    partMeshes.set(mk, mesh);
  }
  const box = partGeo(partId).geometry.boundingBox!.clone();
  const { w, h } = fitOrtho(o.camera, box, dirFromAngles(az, el), 1, 1.08);
  // fitOrtho picks a square frame; recompute a tight one for the true aspect.
  const tight = fitOrtho(o.camera, box, dirFromAngles(az, el), projectedAspect(o.camera, box), 1.08);
  void w; void h;
  const SS = 2; // supersample for crisp lines
  const pw = Math.max(8, tight.w * pxPerStud);
  const ph = Math.max(8, tight.h * pxPerStud);
  const url = o.draw(mesh.group, pw * SS, ph * SS);
  const img = { url, w: pw, h: ph };
  partCache.set(k, img);
  return img;
}

function projectedAspect(cam: THREE.OrthographicCamera, box: THREE.Box3) {
  const inv = cam.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  return (maxX - minX) / Math.max(1e-6, maxY - minY);
}

/* ------------------------------ step images ------------------------------ */

export interface StepImage {
  url: string;
  /** Attach arrows in normalized image coords (0..1, y down). */
  arrows: { from: [number, number]; to: [number, number] }[];
}

/** Per-model renderer for instruction steps. */
export class StepRenderer {
  readonly mesh: BrickMesh;
  private cache = new Map<string, StepImage>();
  private finalBox: THREE.Box3;
  private subOf: (string | undefined)[];
  /** step index at which each brick becomes part of the main model */
  private mainStep: number[];

  constructor(readonly model: Model) {
    this.mesh = new BrickMesh(model.bricks);
    this.mesh.setStyle('instructions');
    this.finalBox = this.mesh.bounds(() => true);
    this.subOf = model.bricks.map((b) => b.sub);
    const attachStep = new Map<string, number>();
    for (const s of model.steps) if (s.attaches) attachStep.set(s.attaches, s.index);
    this.mainStep = model.bricks.map((b) => (b.sub ? (attachStep.get(b.sub) ?? b.step) : b.step));
  }

  /**
   * Render the model as it looks after step `si`.
   * Main steps show the main model; sub-assembly steps show only that sub-assembly.
   */
  step(si: number, w: number, h: number, highlightNew = false): StepImage {
    const k = `${si}|${w}|${h}|${highlightNew}`;
    const hit = this.cache.get(k);
    if (hit) return hit;
    const s = this.model.steps[si];
    const m = this.mesh;
    const isSub = !!s.sub;
    const lift = new THREE.Vector3(0, 0, 0);
    if (s.attaches) {
      const sb = m.bounds((i) => this.subOf[i] === s.attaches);
      lift.set(0, Math.max(2.4, sb.getSize(new THREE.Vector3()).y * 0.9) + 1.2, 0);
    }
    for (let i = 0; i < m.count; i++) {
      const b = this.model.bricks[i];
      let vis: boolean;
      if (isSub) vis = b.sub === s.sub && b.step <= si;
      else vis = this.mainStep[i] <= si;
      const isNew = vis && (b.step === si || (s.attaches !== undefined && b.sub === s.attaches));
      if (!vis) m.set(i, -1);
      else if (s.attaches && b.sub === s.attaches) m.set(i, 0, lift.x, lift.y, lift.z);
      else m.set(i, highlightNew && isNew ? 0.6 : 0);
    }
    m.commit();
    const visible = (i: number) => (isSub ? this.subOf[i] === s.sub && this.model.bricks[i].step <= si : this.mainStep[i] <= si);
    const box = m.bounds(visible);
    if (s.attaches) {
      const lifted = m.bounds((i) => this.subOf[i] === s.attaches);
      lifted.translate(lift);
      box.union(lifted);
    }
    // Keep a stable scale: never zoom in further than ~35% of the finished model.
    if (!isSub) {
      const finalSize = this.finalBox.getSize(new THREE.Vector3()).length();
      const size = box.getSize(new THREE.Vector3()).length();
      if (size < finalSize * 0.35) box.expandByScalar((finalSize * 0.35 - size) / 3.4);
    } else {
      const size = box.getSize(new THREE.Vector3()).length();
      if (size < 6) box.expandByScalar((6 - size) / 3.4);
    }
    const o = offscreen();
    fitOrtho(o.camera, box, dirFromAngles(s.view, EL_DEFAULT), w / h, 1.06);
    const SS = 2;
    const url = o.draw(m.group, w * SS, h * SS);
    const arrows: StepImage['arrows'] = [];
    if (s.attaches) {
      const sb = m.bounds((i) => this.subOf[i] === s.attaches);
      const c = sb.getCenter(new THREE.Vector3());
      const top = new THREE.Vector3(c.x, sb.min.y + 0.1, c.z);
      const from = top.clone().add(lift).add(new THREE.Vector3(0, -0.25, 0));
      const to = top.clone().add(new THREE.Vector3(0, 0.35, 0));
      const proj = (v: THREE.Vector3) => {
        const p = v.clone().project(o.camera);
        return [(p.x + 1) / 2, (1 - p.y) / 2] as [number, number];
      };
      arrows.push({ from: proj(from), to: proj(to) });
    }
    const img = { url, arrows };
    this.cache.set(k, img);
    return img;
  }

  /** A finished sub-assembly, for "attach" callouts and the parts box. */
  subAssembly(name: string, pxPerStud = 14): PartImage {
    const k = `sub|${name}|${pxPerStud}`;
    const hit = this.cache.get(k);
    if (hit) return { url: hit.url, w: (hit as unknown as PartImage).w, h: (hit as unknown as PartImage).h };
    const m = this.mesh;
    for (let i = 0; i < m.count; i++) m.set(i, this.subOf[i] === name ? 0 : -1);
    m.commit();
    const box = m.bounds((i) => this.subOf[i] === name);
    const o = offscreen();
    const dir = dirFromAngles(35, EL_DEFAULT);
    fitOrtho(o.camera, box, dir, 1, 1.05);
    const asp = projectedAspect(o.camera, box);
    const t = fitOrtho(o.camera, box, dir, asp, 1.05);
    const pw = t.w * pxPerStud, ph = t.h * pxPerStud;
    const url = o.draw(m.group, pw * 2, ph * 2);
    const img = { url, w: pw, h: ph };
    this.cache.set(k, img as unknown as StepImage);
    return img;
  }

  /** Hero render of the complete model. */
  hero(w: number, h: number, style: RenderStyle = 'instructions', az = this.model.heroView ?? 35, el = 28): string {
    const k = `hero|${w}|${h}|${style}|${az}|${el}`;
    const hit = this.cache.get(k);
    if (hit) return hit.url;
    const m = this.mesh;
    m.setAll(0);
    m.setStyle(style, true);
    const o = offscreen();
    fitOrtho(o.camera, this.finalBox, dirFromAngles(az, el), w / h, 1.08);
    const url = o.draw(m.group, w * 2, h * 2, style);
    m.setStyle('instructions');
    this.cache.set(k, { url, arrows: [] });
    return url;
  }

  /** The finished model framed tightly, at most maxW x maxH CSS px (for catalog cards and the skyline). */
  heroTight(maxW: number, maxH: number, style: RenderStyle = 'instructions', az = this.model.heroView ?? 35, el = 24): PartImage {
    const m = this.mesh;
    m.setAll(0);
    m.setStyle(style, true);
    const o = offscreen();
    const dir = dirFromAngles(az, el);
    fitOrtho(o.camera, this.finalBox, dir, 1, 1.04);
    const asp = projectedAspect(o.camera, this.finalBox);
    fitOrtho(o.camera, this.finalBox, dir, asp, 1.04);
    const k = Math.min(maxW / asp, maxH);
    const w = Math.round(k * asp), h = Math.round(k);
    const url = o.draw(m.group, w * 2, h * 2, style);
    m.setStyle('instructions');
    return { url, w, h };
  }

  dispose() {
    this.mesh.dispose();
  }
}

/** Approximate real-world size of a model in cm (1 stud = 0.8 cm, 1 plate = 0.32 cm). */
export function realSizeCm(model: Model) {
  const box = new THREE.Box3();
  const m = new BrickMesh(model.bricks);
  box.copy(m.bounds(() => true));
  m.dispose();
  const s = box.getSize(new THREE.Vector3());
  return { w: s.x * 0.8, h: (s.y / PLATE) * 0.32, d: s.z * 0.8 };
}
