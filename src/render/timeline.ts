import * as THREE from 'three';
import type { Model } from '../lego/types';
import type { BrickMesh } from './brickMesh';
import { dirFromAngles } from './stage';

/**
 * Build-animation schedule. Every brick's state is a pure function of the global
 * time t, so seeking, scrubbing, speed changes and video export all reduce to
 * "set t". Sub-assemblies are built in a side bay next to the model and then
 * lifted, flown over and lowered into place.
 */

export interface BrickAnim {
  start: number;
  dur: number;
  land: number;
}

export interface AttachAnim {
  sub: string;
  start: number;
  dur: number;
}

export interface Schedule {
  anims: BrickAnim[];
  stepStart: number[];
  stepEnd: number[];
  attaches: Map<string, AttachAnim>;
  bays: Map<string, THREE.Vector3>;
  total: number;
  /** extra hold at the end for the finished-model turntable */
  outro: number;
  drop: number;
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function buildSchedule(model: Model, mesh: BrickMesh): Schedule {
  const N = model.bricks.length;
  let dur = 460, stagger = 190, hold = 420;
  if (N > 60) [dur, stagger, hold] = [420, 130, 320];
  if (N > 250) [dur, stagger, hold] = [380, 80, 220];
  const attachDur = 1500;

  // Side bays for sub-assemblies: on the table to the camera's right of the model.
  const bays = new Map<string, THREE.Vector3>();
  const main = mesh.bounds((i) => !model.bricks[i].sub);
  const mainR = main.getBoundingSphere(new THREE.Sphere()).radius;
  const right = new THREE.Vector3().crossVectors(dirFromAngles(model.heroView ?? 35, 0).negate(), new THREE.Vector3(0, 1, 0)).normalize();
  for (const s of model.steps) {
    if (!s.attaches || bays.has(s.attaches)) continue;
    const name = s.attaches;
    const sb = mesh.bounds((i) => model.bricks[i].sub === name);
    const sr = sb.getBoundingSphere(new THREE.Sphere()).radius;
    const c = sb.getCenter(new THREE.Vector3());
    const mc = main.getCenter(new THREE.Vector3());
    const target = mc.clone().addScaledVector(right, mainR + sr + 1.5);
    bays.set(name, new THREE.Vector3(target.x - c.x, -sb.min.y + Math.max(0, main.min.y), target.z - c.z));
  }

  const anims: BrickAnim[] = new Array(N);
  const stepStart: number[] = [];
  const stepEnd: number[] = [];
  const attaches = new Map<string, AttachAnim>();
  let t = 300;
  for (const s of model.steps) {
    stepStart.push(t);
    if (s.attaches) {
      attaches.set(s.attaches, { sub: s.attaches, start: t, dur: attachDur });
      t += attachDur + hold;
    } else {
      s.bricks.forEach((id, k) => {
        const start = t + k * stagger;
        anims[id] = { start, dur, land: start + dur };
      });
      t += Math.max(0, s.bricks.length - 1) * stagger + dur + hold;
    }
    stepEnd.push(t);
  }
  // Long builds: compress to a watchable length at 1x (speed controls do the rest).
  const maxTotal = 110_000;
  if (t > maxTotal) {
    const k = maxTotal / t;
    for (const a of anims) {
      a.start *= k;
      a.dur = Math.max(260, a.dur * k);
      a.land = a.start + a.dur;
    }
    for (let i = 0; i < stepStart.length; i++) {
      stepStart[i] *= k;
      stepEnd[i] *= k;
    }
    for (const a of attaches.values()) {
      a.start *= k;
      a.dur = Math.max(900, a.dur * k);
    }
    t = maxTotal;
  }
  const outro = 4000;
  return { anims, stepStart, stepEnd, attaches, bays, total: t + outro, outro, drop: 4.8 };
}

const _v = new THREE.Vector3();

/** Offset of a sub-assembly at time t (bay → lift → fly → lower). */
export function subOffset(sch: Schedule, sub: string, t: number, out = new THREE.Vector3()) {
  const bay = sch.bays.get(sub);
  const a = sch.attaches.get(sub);
  if (!bay || !a) return out.set(0, 0, 0);
  if (t <= a.start) return out.copy(bay);
  const u = clamp01((t - a.start) / a.dur);
  if (u >= 1) return out.set(0, 0, 0);
  const lift = 3.6;
  if (u < 0.22) {
    // lift off the table to just above the attachment height
    const e = easeInOutCubic(u / 0.22);
    return out.set(bay.x, bay.y + (lift - bay.y) * e, bay.z);
  }
  if (u < 0.72) {
    // fly across
    const e = easeInOutCubic((u - 0.22) / 0.5);
    return out.set(bay.x * (1 - e), lift, bay.z * (1 - e));
  }
  // lower into place
  const e = easeOutCubic((u - 0.72) / 0.28);
  return out.set(0, lift * (1 - e), 0);
}

/** Apply the schedule to the mesh at time t. Returns the current step index. */
export function applyTime(model: Model, sch: Schedule, mesh: BrickMesh, t: number): number {
  const subOff = new Map<string, THREE.Vector3>();
  for (const name of sch.bays.keys()) subOff.set(name, subOffset(sch, name, t, new THREE.Vector3()));
  for (let i = 0; i < model.bricks.length; i++) {
    const a = sch.anims[i];
    if (!a || t < a.start) {
      mesh.set(i, -1);
      continue;
    }
    const u = clamp01((t - a.start) / a.dur);
    const dy = (1 - easeOutCubic(u)) * sch.drop;
    const b = model.bricks[i];
    _v.set(0, 0, 0);
    if (b.sub) _v.copy(subOff.get(b.sub) ?? _v);
    const since = t - a.land;
    const flash = u >= 1 ? clamp01(1 - since / 450) * 0.75 : 0.15;
    mesh.set(i, flash, _v.x, _v.y + dy, _v.z);
  }
  mesh.commit();
  return stepAt(sch, t);
}

export function stepAt(sch: Schedule, t: number) {
  let lo = 0, hi = sch.stepStart.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sch.stepStart[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Bricks that land in (t0, t1] — used for click sounds. */
export function landingsBetween(sch: Schedule, t0: number, t1: number) {
  let n = 0;
  for (const a of sch.anims) if (a && a.land > t0 && a.land <= t1) n++;
  for (const a of sch.attaches.values()) if (a.start + a.dur > t0 && a.start + a.dur <= t1) n++;
  return n;
}

/** World-space box the camera should frame at time t (placed bricks + active sub bay). */
export function frameBox(model: Model, sch: Schedule, mesh: BrickMesh, t: number, out = new THREE.Box3()) {
  out.makeEmpty();
  const off = new Map<string, THREE.Vector3>();
  for (const name of sch.bays.keys()) off.set(name, subOffset(sch, name, t, new THREE.Vector3()));
  const tmp = new THREE.Box3();
  for (let i = 0; i < model.bricks.length; i++) {
    const a = sch.anims[i];
    if (!a || t < a.start) continue;
    const b = model.bricks[i];
    tmp.copy(mesh.boxes[i]);
    if (b.sub) tmp.translate(off.get(b.sub)!);
    out.union(tmp);
  }
  return out;
}
