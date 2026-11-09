import * as THREE from 'three';
import type { Model } from '../lego/types';
import { click, fanfare } from '../ui/sound';
import { BrickMesh, type RenderStyle } from './brickMesh';
import { dirFromAngles, Viewer } from './stage';
import { applyTime, buildSchedule, frameBox, landingsBetween, type Schedule } from './timeline';

/**
 * Drives the "whole build" animation: schedule + viewer + an automatic camera
 * rig that re-frames the growing model and slowly orbits it while playing.
 */
export class BuildEngine {
  readonly viewer: Viewer;
  readonly mesh: BrickMesh;
  readonly sch: Schedule;
  t = 0;
  speed = 1;
  playing = false;
  loop = false;
  sound = true;
  orbit = true;
  autoCam = true;
  private step = -2;
  private az: number;
  private el = 24;
  private camTarget = new THREE.Vector3();
  private camDist = 10;
  private goalTarget = new THREE.Vector3();
  private goalDist = 10;
  private maxDist = 0;
  private mainMaxDist = 0;
  private lastFrameT = -1;
  private finished = false;
  private recorder: MediaRecorder | null = null;
  onStep: ((i: number) => void) | null = null;
  onTick: ((t: number) => void) | null = null;
  onPlayState: ((playing: boolean) => void) | null = null;
  onRecordState: ((recording: boolean) => void) | null = null;
  onCamMode: ((auto: boolean) => void) | null = null;

  constructor(host: HTMLElement, readonly model: Model, style: RenderStyle = 'instructions') {
    this.viewer = new Viewer(host);
    this.mesh = new BrickMesh(model.bricks);
    this.viewer.setMesh(this.mesh);
    this.viewer.setStyle(style);
    this.sch = buildSchedule(model, this.mesh);
    this.az = model.heroView ?? 35;
    const full = this.mesh.bounds(() => true);
    this.viewer.setGround(full.min.y);
    const size = full.getSize(new THREE.Vector3());
    const flatness = size.y / Math.max(size.x, size.z, 1);
    this.el = flatness < 0.3 ? 36 : flatness < 0.6 ? 28 : 22;
    // start framed on the finished footprint so the first bricks don't fill the screen
    const start = this.idealFrame(full, true);
    this.camTarget.copy(start.target);
    this.camDist = start.dist * 0.75;
    this.viewer.controls.addEventListener('start', () => {
      if (this.autoCam) {
        this.autoCam = false;
        this.onCamMode?.(false);
      }
    });
    this.viewer.onFrame = (dt) => this.frame(dt);
    this.seek(0);
  }

  private idealFrame(box: THREE.Box3, initial = false) {
    const s = box.isEmpty() ? new THREE.Sphere(new THREE.Vector3(), 4) : box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(s.radius, initial ? 6 : 3.5);
    return { target: s.center.clone(), dist: this.viewer.fitDistance(r) };
  }

  seek(t: number) {
    const backwards = t < this.t - 1;
    this.t = Math.max(0, Math.min(t, this.sch.total));
    if (backwards) {
      this.maxDist = 0;
      this.mainMaxDist = 0;
      this.finished = false;
    }
    this.update(true);
  }

  play() {
    if (this.t >= this.sch.total - 1) this.seek(0);
    this.playing = true;
    this.onPlayState?.(true);
  }

  pause() {
    this.playing = false;
    this.onPlayState?.(false);
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  recenter() {
    this.autoCam = true;
    // continue orbiting from wherever the user left the camera
    const off = this.viewer.camera.position.clone().sub(this.viewer.controls.target);
    this.az = THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z));
    this.onCamMode?.(true);
  }

  setStyle(style: RenderStyle) {
    this.viewer.setStyle(style);
  }

  stepStart(i: number) {
    return this.sch.stepStart[Math.max(0, Math.min(i, this.sch.stepStart.length - 1))];
  }

  /** Jump to the end state of step i. */
  gotoStep(i: number) {
    const k = Math.max(0, Math.min(i, this.model.steps.length - 1));
    this.seek(this.sch.stepEnd[k] - 1);
  }

  private update(force = false) {
    const step = applyTime(this.model, this.sch, this.mesh, this.t);
    if (step !== this.step) {
      this.step = step;
      this.onStep?.(step);
    }
    if (force || this.autoCam) {
      const box = frameBox(this.model, this.sch, this.mesh, this.t);
      const f = this.idealFrame(box);
      this.goalTarget.copy(f.target);
      // Never creep closer while the model grows (avoids "breathing"), but once a
      // sub-assembly built on the side has been attached, return to the model.
      if (this.bayActive()) {
        this.maxDist = Math.max(this.maxDist, f.dist);
      } else {
        this.mainMaxDist = Math.max(this.mainMaxDist, f.dist);
        this.maxDist = this.mainMaxDist;
      }
      this.goalDist = this.maxDist;
      if (force && !this.playing) {
        this.camTarget.lerp(this.goalTarget, 0.5);
        this.camDist = this.camDist * 0.5 + this.goalDist * 0.5;
      }
    }
    this.onTick?.(this.t);
  }

  /** Is a sub-assembly currently being built (or carried) beside the model? */
  private bayActive() {
    for (const [name, a] of this.sch.attaches) {
      if (this.t >= a.start + a.dur) continue;
      const first = this.model.bricks.find((b) => b.sub === name);
      const an = first && this.sch.anims[first.id];
      if (an && this.t >= an.start) return true;
    }
    return false;
  }

  private frame(dt: number) {
    if (this.playing) {
      const prev = this.t;
      // the finished-model turntable always plays at normal speed, however fast the build ran
      const lastEnd = this.sch.stepEnd[this.sch.stepEnd.length - 1] ?? 0;
      const rate = this.t >= lastEnd ? 1 : this.speed;
      this.t = Math.min(this.t + dt * rate, this.sch.total);
      if (this.sound && !this.recorder) {
        const n = landingsBetween(this.sch, prev, this.t);
        if (n > 0) click(0.3);
      }
      if (!this.finished && this.t >= lastEnd) {
        this.finished = true;
        if (this.sound) fanfare();
      }
      if (this.t >= this.sch.total) {
        if (this.recorder) {
          this.stopRecording();
        } else if (this.loop) {
          this.seek(0);
        } else {
          this.pause();
        }
      }
      if (this.t !== this.lastFrameT) this.update();
      this.lastFrameT = this.t;
    }
    if (this.autoCam) {
      const k = 1 - Math.exp(-dt / 350);
      this.camTarget.lerp(this.goalTarget, k);
      this.camDist += (this.goalDist - this.camDist) * k;
      const orbitSpeed = this.t >= this.sch.total - this.sch.outro ? 24 : 7; // faster turntable at the end
      if (this.orbit && this.playing) this.az += (orbitSpeed * dt * Math.min(this.speed, 2)) / 1000;
      const cam = this.viewer.camera;
      cam.position.copy(this.camTarget).addScaledVector(dirFromAngles(this.az, this.el), this.camDist);
      this.viewer.controls.target.copy(this.camTarget);
      cam.near = Math.max(0.1, this.camDist / 100);
      cam.far = this.camDist * 20;
      cam.updateProjectionMatrix();
      this.viewer.updateShadow(this.camTarget, this.camDist);
    }
  }

  private ray = new THREE.Raycaster();
  /** Which (visible, resting) brick is under the given client coordinates? */
  pickAt(clientX: number, clientY: number): number | null {
    const el = this.viewer.renderer.domElement;
    const r = el.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.viewer.camera);
    return this.mesh.pick(this.ray);
  }

  /** Record the whole build to a video file in real time. */
  record(onDone: (blob: Blob, ext: string) => void) {
    const canvas = this.viewer.renderer.domElement;
    const stream = canvas.captureStream(30);
    const types = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const type = rec.mimeType || 'video/webm';
      onDone(new Blob(chunks, { type }), type.includes('mp4') ? 'mp4' : 'webm');
      this.recorder = null;
      this.onRecordState?.(false);
    };
    this.recorder = rec;
    this.autoCam = true;
    this.onCamMode?.(true);
    this.seek(0);
    rec.start(250);
    this.onRecordState?.(true);
    this.play();
  }

  stopRecording() {
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    this.pause();
  }

  get recording() {
    return !!this.recorder;
  }

  dispose() {
    this.stopRecording();
    this.viewer.dispose();
    this.mesh.dispose();
  }
}
