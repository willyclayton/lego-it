import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { BrickMesh, RenderStyle } from './brickMesh';

export const EL_DEFAULT = 30;

export function dirFromAngles(azDeg: number, elDeg: number) {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(elDeg);
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** Lights and environment shared by the interactive viewer and the page renderer. */
export function makeLights(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c4d0, 1.6);
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-6, 14, 9);
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(10, 4, 6);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(hemi, key, key.target, fill, ambient);

  const apply = (style: RenderStyle) => {
    if (style === 'realistic') {
      scene.environment = env;
      scene.environmentIntensity = 0.85;
      hemi.intensity = 0.55;
      key.intensity = 2.2;
      fill.intensity = 0.4;
      ambient.intensity = 0.1;
      key.castShadow = true;
    } else {
      scene.environment = null;
      hemi.intensity = 1.45;
      key.intensity = 1.35;
      fill.intensity = 0.55;
      ambient.intensity = 0.55;
      key.castShadow = false;
    }
  };
  return { key, apply, env };
}

/** Fit an orthographic camera to a box from a given direction. */
export function fitOrtho(cam: THREE.OrthographicCamera, box: THREE.Box3, dir: THREE.Vector3, aspect: number, margin = 1.12) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  cam.position.copy(center).addScaledVector(dir, size * 4 + 20);
  cam.up.set(0, 1, 0);
  cam.lookAt(center);
  cam.updateMatrixWorld();
  // project the 8 corners into camera space to find extents
  const inv = cam.matrixWorldInverse;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let w = (maxX - minX) * margin;
  let h = (maxY - minY) * margin;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  cam.left = cx - w / 2;
  cam.right = cx + w / 2;
  cam.top = cy + h / 2;
  cam.bottom = cy - h / 2;
  cam.near = 0.1;
  cam.far = size * 10 + 100;
  cam.updateProjectionMatrix();
  return { w, h };
}

/**
 * Interactive viewer: perspective camera + orbit controls + optional ground shadow.
 */
export class Viewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
  readonly controls: OrbitControls;
  private lights: ReturnType<typeof makeLights>;
  private ground: THREE.Mesh;
  mesh: BrickMesh | null = null;
  style: RenderStyle = 'instructions';
  private ro: ResizeObserver;
  private raf = 0;
  onFrame: ((dt: number, now: number) => void) | null = null;
  private last = performance.now();

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NoToneMapping;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.lights = makeLights(this.scene, this.renderer);
    const sh = this.lights.key.shadow;
    sh.mapSize.set(2048, 2048);
    sh.bias = -0.0005;
    sh.normalBias = 0.02;
    sh.radius = 4;

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.18 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.001;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI * 0.95;

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(now - this.last, 100);
      this.last = now;
      this.onFrame?.(dt, now);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  setMesh(mesh: BrickMesh) {
    if (this.mesh) this.scene.remove(this.mesh.group);
    this.mesh = mesh;
    this.scene.add(mesh.group);
    mesh.setStyle(this.style);
  }

  setStyle(style: RenderStyle) {
    this.style = style;
    this.lights.apply(style);
    this.renderer.toneMapping = style === 'realistic' ? THREE.NeutralToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.ground.visible = style === 'realistic';
    this.mesh?.setStyle(style);
  }

  /** Distance needed for a perspective camera to fit a sphere. */
  fitDistance(radius: number) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fovH = 2 * Math.atan(Math.tan(fov / 2) * this.camera.aspect);
    return (radius * 1.15) / Math.sin(Math.min(fov, fovH) / 2);
  }

  frame(box: THREE.Box3, azDeg: number, elDeg = EL_DEFAULT) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const d = this.fitDistance(Math.max(sphere.radius, 2));
    this.controls.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(dirFromAngles(azDeg, elDeg), d);
    this.camera.near = Math.max(0.1, d / 100);
    this.camera.far = d * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
    const sh = this.lights.key.shadow.camera as THREE.OrthographicCamera;
    const r = sphere.radius * 1.4 + 2;
    sh.left = -r; sh.right = r; sh.top = r; sh.bottom = -r;
    sh.near = 0.5; sh.far = 200;
    sh.updateProjectionMatrix();
    this.lights.key.target.position.copy(sphere.center);
    this.lights.key.position.copy(sphere.center).add(new THREE.Vector3(-6, 14, 9).normalize().multiplyScalar(60));
  }

  setGround(y: number) {
    this.ground.position.y = y - 0.001;
  }

  /** Keep the shadow camera wrapped around the area being looked at. */
  updateShadow(center: THREE.Vector3, dist: number) {
    const key = this.lights.key;
    const sh = key.shadow.camera as THREE.OrthographicCamera;
    const r = Math.max(6, dist * 0.45);
    if (Math.abs(sh.right - r) > r * 0.15) {
      sh.left = -r; sh.right = r; sh.top = r; sh.bottom = -r;
      sh.near = 0.5; sh.far = r * 6 + 60;
      sh.updateProjectionMatrix();
    }
    key.target.position.set(center.x, 0, center.z);
    key.position.set(center.x, 0, center.z).add(new THREE.Vector3(-6, 14, 9).normalize().multiplyScalar(r * 2 + 30));
  }

  snapshot(type = 'image/png') {
    return this.renderer.domElement.toDataURL(type);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
