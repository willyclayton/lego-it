import * as THREE from 'three';
import { BRIDGE_ID, type BridgeBox, buildBoat, buildBridges, buildCity, buildWheel, WHEEL_ID } from './geometry';
import { LAND_Y, PLATE, routeAt, type World } from './world';

export type Selection = { kind: 'building'; id: number } | { kind: 'bridge'; index: number } | { kind: 'poi'; index: number };

const SKY = new THREE.Color('#bfe1f2');
const SUN = new THREE.Vector3(0.48, 0.78, 0.4).normalize();

const COMMON = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uFog; uniform float uFogNear; uniform float uFogFar; uniform float uTime;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // a plate seen from above: one stud per cell, with a lit and a shaded side
  vec3 studs(vec3 base, vec2 xz, float amount) {
    vec2 f = fract(xz) - 0.5; float r = length(f);
    float fw = fwidth(xz.x) + fwidth(xz.y);
    float vis = clamp(1.0 - fw * 1.6, 0.0, 1.0) * amount;
    float aa = max(fw, 0.02);
    float inside = 1.0 - smoothstep(0.31 - aa, 0.31 + aa, r);
    float ring = smoothstep(0.31 - aa, 0.31, r) * (1.0 - smoothstep(0.31, 0.44, r));
    float side = dot(f / max(r, 1e-3), normalize(uSun.xz));
    float edge = smoothstep(0.17, 0.31, r) * inside;
    vec2 g = abs(f); float seam = smoothstep(0.5 - aa * 1.5, 0.5, max(g.x, g.y));
    return base * (1.0 + vis * (inside * 0.05 + edge * side * 0.2 - ring * (0.5 - 0.5 * side) * 0.22 - seam * 0.1));
  }
  vec3 fogged(vec3 c, vec3 w) { return mix(c, uFog, smoothstep(uFogNear, uFogFar, length(cameraPosition - w))); }
`;

function brickMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uFog: { value: SKY }, uFogNear: { value: 380 }, uFogFar: { value: 1900 }, uTime: { value: 0 }, uSel: { value: -1 } },
    vertexShader: /* glsl */ `
      attribute vec4 color; attribute float oid;
      varying vec3 vW; varying vec3 vN; varying vec4 vC; varying float vId;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; vId = oid;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform float uSel;
      varying vec3 vW; varying vec3 vN; varying vec4 vC; varying float vId;
      void main() {
        vec3 n = normalize(vN);
        vec3 base = vC.rgb; float style = floor(vC.a * 255.0 + 0.5);
        if (n.y > 0.6) {
          base = studs(base * (style == 1.0 ? 0.8 : 1.0), vW.xz, style == 4.0 ? 0.0 : 1.0);
        } else if (abs(n.y) < 0.4 && style != 3.0) {
          float u = abs(n.x) > 0.5 ? vW.z : vW.x;
          float v = (vW.y - ${LAND_Y.toFixed(1)}) / 1.2;                    // one brick course = 3 plates
          float fu = fwidth(u), fv = fwidth(v);
          float visU = clamp(1.0 - fu * 2.2, 0.0, 1.0), visV = clamp(1.0 - fv * 2.2, 0.0, 1.0);
          float course = floor(v);
          float cu = fract(u), cv = fract(v);
          float au = max(fu, 0.015), av = max(fv, 0.015);
          // every 1x2 brick is a slightly different shade
          float shade = (hash(vec2(floor(u * 0.5 + mod(course, 2.0) * 0.5), course)) - 0.5) * 0.09 * visU * visV;
          vec3 glass = vec3(0.13, 0.2, 0.28);
          if (style == 0.0) {                                              // masonry: one window per stud per course
            float win = smoothstep(0.24 - au, 0.24 + au, cu) * (1.0 - smoothstep(0.76 - au, 0.76 + au, cu)) * smoothstep(0.3 - av, 0.3 + av, cv) * (1.0 - smoothstep(0.82 - av, 0.82 + av, cv));
            base = mix(base * (1.0 + shade), mix(base, glass, 0.82), win * mix(0.45, 1.0, visU * visV));
          } else if (style == 1.0) {                                       // curtain wall: glass with a mullion grid
            float mull = max(1.0 - smoothstep(0.0, au * 1.5 + 0.03, min(cu, 1.0 - cu)), 0.0) * visU;
            float span = (1.0 - smoothstep(0.0, av * 1.5 + 0.05, min(cv, 1.0 - cv))) * visV;
            float pane = hash(vec2(floor(u), floor(v * 2.0)));
            base = base * (0.74 + 0.1 * pane * visU * visV + 0.14 * cv * visV);
            base = mix(base, base * 1.35 + 0.08, max(mull * 0.6, span * 0.75));
          } else if (style == 2.0) {                                       // ribbon windows between piers
            float band = smoothstep(0.34 - av, 0.34 + av, cv) * (1.0 - smoothstep(0.84 - av, 0.84 + av, cv));
            float pier = smoothstep(0.1 - au, 0.1 + au, cu) * (1.0 - smoothstep(0.9 - au, 0.9 + au, cu));
            base = mix(base * (1.0 + shade), mix(base, glass, 0.85), band * mix(1.0, pier, visU) * mix(0.5, 1.0, visV));
          } else {                                                         // stone
            base *= 1.0 + shade;
          }
          float seam = (1.0 - smoothstep(0.0, av * 1.2 + 0.012, min(cv, 1.0 - cv))) * visV;
          base *= 1.0 - seam * 0.12;
          base *= 0.8 + 0.2 * smoothstep(0.0, 5.0, vW.y - ${LAND_Y.toFixed(1)});   // darker toward the street
        }
        float ndl = max(dot(n, uSun), 0.0);
        vec3 c = base * (mix(0.5, 0.7, n.y * 0.5 + 0.5) + 0.5 * ndl);
        if (uSel >= 0.0 && abs(vId - uSel) < 0.5) c = mix(c, vec3(1.0, 0.8, 0.05), 0.42 + 0.12 * sin(uTime * 5.0));
        gl_FragColor = vec4(fogged(c, vW), 1.0);
      }`,
  });
}

function groundMaterial(tex: THREE.DataTexture, w: number, h: number, water: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uFog: { value: SKY }, uFogNear: { value: 380 }, uFogFar: { value: 1900 }, uTime: { value: 0 }, uCls: { value: tex }, uSize: { value: new THREE.Vector2(w, h) } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: /* glsl */ `
      ${COMMON}
      uniform sampler2D uCls; uniform vec2 uSize;
      varying vec3 vW;
      void main() {
        vec2 cell = vW.xz;
        bool inside = cell.x >= 0.0 && cell.y >= 0.0 && cell.x < uSize.x && cell.y < uSize.y;
        float cls = inside ? floor(texture2D(uCls, (floor(cell) + 0.5) / uSize).r * 255.0 + 0.5) : (cell.x > 1160.0 ? 1.0 : 10.0);
        bool wet = cls == 1.0 || cls == 2.0;
        vec3 c;
        ${
          water
            ? /* glsl */ `
        // trans-blue tiles with a slow shimmer
        vec3 lake = vec3(0.16, 0.6, 0.72), river = vec3(0.13, 0.47, 0.47);
        c = cls == 2.0 || !wet ? river : lake;
        vec2 t = floor(cell * 0.5);
        float fw = fwidth(cell.x) + fwidth(cell.y);
        float vis = clamp(1.0 - fw * 0.9, 0.0, 1.0);
        float tw = 0.5 + 0.5 * sin(uTime * (0.6 + hash(t) * 1.2) + hash(t + 7.0) * 6.283);
        c *= 0.93 + vis * (0.1 * tw + 0.05 * hash(t + 3.0));
        vec2 g = abs(fract(cell * 0.5) - 0.5); float seam = smoothstep(0.5 - max(fw, 0.02), 0.5, max(g.x, g.y));
        c *= 1.0 - seam * 0.1 * vis;
        c += vec3(0.25) * vis * pow(tw, 12.0) * step(0.86, hash(t + 11.0));`
            : /* glsl */ `
        if (wet) discard;
        float st = 1.0;
        if (cls == 4.0) { c = vec3(0.38, 0.39, 0.38); st = 0.0; }             // streets: dark tiles
        else if (cls == 5.0) c = vec3(0.3, 0.6, 0.29);                           // parks
        else if (cls == 6.0) { c = vec3(0.86, 0.79, 0.64); st = 0.0; }          // plazas and piers: tan tiles
        else if (cls == 7.0) c = vec3(0.53, 0.5, 0.42);                          // rail yards
        else if (cls == 8.0) c = vec3(0.92, 0.84, 0.64);                         // beaches
        else if (cls == 9.0) { c = vec3(0.5, 0.5, 0.5); st = 0.4; }             // breakwaters
        else if (cls == 10.0) c = vec3(0.6, 0.63, 0.62);                         // beyond the mapped area
        else c = vec3(0.66, 0.68, 0.69);                                         // city blocks
        if (st == 0.0) {
          vec2 g = abs(fract(cell) - 0.5); float fw = fwidth(cell.x) + fwidth(cell.y);
          c *= 1.0 - smoothstep(0.5 - max(fw, 0.02), 0.5, max(g.x, g.y)) * 0.07 * clamp(1.0 - fw * 1.6, 0.0, 1.0);
        } else c = studs(c, cell, st);`
        }
        c *= 0.62 + 0.5 * uSun.y;
        gl_FragColor = vec4(fogged(c, vW), 1.0);
      }`,
  });
}

export class RiverScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.5, 4000);
  /** distance along the route in cells */
  s = 0;
  /** cells per second */
  speed = 5;
  playing = false;
  yawOff = 0;
  pitch = 0.36;
  dist = 34;
  onTick: ((s: number) => void) | null = null;
  onPick: ((sel: Selection | null) => void) | null = null;
  onFrame: (() => void) | null = null;
  onEnd: (() => void) | null = null;

  private mats: THREE.ShaderMaterial[] = [];
  private brick: THREE.ShaderMaterial;
  private boat: THREE.Mesh;
  private boxes: BridgeBox[];
  private heading = 0;
  private camYaw = 0;
  private boatPos = new THREE.Vector3();
  private raf = 0;
  private last = 0;
  private time = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; moved: number; pinch: number } | null = null;
  private wheelPos: [number, number];
  private focus: THREE.Vector3 | null = null;

  constructor(private host: HTMLElement, readonly world: World) {
    const narrow = host.clientWidth < 760;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, narrow ? 1.5 : 2));
    this.renderer.setClearColor(SKY);
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    const { w, h } = world;
    const tex = new THREE.DataTexture(world.ground, w, h, THREE.RedFormat, THREE.UnsignedByteType);
    tex.unpackAlignment = 1;
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const plane = (y: number, mat: THREE.ShaderMaterial, size = 9000) => {
      const g = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2).translate(w / 2, y, h / 2);
      const m = new THREE.Mesh(g, mat);
      m.frustumCulled = false;
      this.scene.add(m);
      this.mats.push(mat);
    };
    plane(0, groundMaterial(tex, w, h, true));
    plane(LAND_Y, groundMaterial(tex, w, h, false));

    this.brick = brickMaterial();
    this.mats.push(this.brick);
    for (const g of buildCity(world)) this.scene.add(new THREE.Mesh(g, this.brick));
    const br = buildBridges(world);
    this.boxes = br.boxes;
    this.scene.add(new THREE.Mesh(br.geometry, this.brick));
    const geo = world.geo;
    this.wheelPos = [((-87.6078 - geo.lonW) * geo.kx) / world.cell, ((geo.latN - 41.8917) * geo.ky) / world.cell];
    this.scene.add(new THREE.Mesh(buildWheel(this.wheelPos[0], this.wheelPos[1]), this.brick));
    this.boat = new THREE.Mesh(buildBoat(), this.brick);
    this.scene.add(this.boat);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.place(true);
    this.raf = requestAnimationFrame(this.loop);
  }

  private resize() {
    const wd = Math.max(1, this.host.clientWidth), ht = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(wd, ht);
    this.camera.aspect = wd / ht;
    this.camera.fov = wd < ht ? 68 : 55;
    this.camera.updateProjectionMatrix();
  }

  private down = (e: PointerEvent) => {
    this.renderer.domElement.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) this.drag = { x: e.clientX, y: e.clientY, moved: 0, pinch: 0 };
    else if (this.drag) {
      const [a, b] = [...this.pointers.values()];
      this.drag.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      this.drag.moved = 99;
    }
  };
  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.drag) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.drag.pinch > 0 && d > 0) this.zoom(this.drag.pinch / d);
      this.drag.pinch = d;
      return;
    }
    this.drag.moved += Math.abs(dx) + Math.abs(dy);
    if (this.drag.moved > 6) {
      this.yawOff += dx * 0.006;
      this.pitch = Math.max(0.04, Math.min(1.45, this.pitch + dy * 0.005));
    }
  };
  private up = (e: PointerEvent) => {
    const had = this.pointers.delete(e.pointerId);
    if (had && this.drag && this.pointers.size === 0) {
      if (this.drag.moved <= 6 && e.type === 'pointerup') this.onPick?.(this.pick(e.clientX, e.clientY));
      this.drag = null;
    }
  };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    this.zoom(Math.exp(e.deltaY * 0.0012));
  };
  zoom(f: number) {
    this.dist = Math.max(9, Math.min(900, this.dist * f));
  }
  resetView() {
    this.yawOff = 0;
    this.pitch = 0.36;
    this.dist = 34;
    this.focus = null;
  }
  /** Look at a point in the world (a selected building) instead of straight ahead; null returns to the boat. */
  lookAt(x: number | null, y = 0, z = 0) {
    this.focus = x === null ? null : new THREE.Vector3(x, y, z);
  }

  setSelected(sel: Selection | null) {
    this.brick.uniforms.uSel.value = !sel ? -1 : sel.kind === 'building' ? sel.id : sel.kind === 'bridge' ? BRIDGE_ID + sel.index : sel.kind === 'poi' && this.world.pois[sel.index].name === 'Navy Pier' ? WHEEL_ID : -1;
  }

  seek(s: number) {
    this.s = Math.max(0, Math.min(s, this.world.length));
    this.place(true);
    this.onTick?.(this.s);
  }

  private place(snap: boolean) {
    const [x, z] = routeAt(this.world, this.s);
    const [bx, bz] = routeAt(this.world, this.s - 5);
    const [fx, fz] = routeAt(this.world, this.s + 9);
    const target = Math.atan2(fz - bz, fx - bx);
    const turn = (from: number, k: number) => from + Math.atan2(Math.sin(target - from), Math.cos(target - from)) * k;
    this.heading = snap ? target : turn(this.heading, this.kBoat);
    this.camYaw = snap ? target : turn(this.camYaw, this.kCam);
    this.boatPos.set(x, 0, z);
    this.boat.position.set(x, Math.sin(this.time * 1.7) * 0.02, z);
    this.boat.rotation.y = -this.heading;
  }
  private eff = 34;
  private kBoat = 1;
  private kCam = 1;

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dt;
    this.kBoat = 1 - Math.exp(-dt / 0.45);
    this.kCam = 1 - Math.exp(-dt / 1.1);
    if (this.playing) {
      this.s = Math.min(this.world.length, this.s + this.speed * dt);
      if (this.s >= this.world.length) {
        this.playing = false;
        this.onEnd?.();
      }
      this.onTick?.(this.s);
    }
    this.place(false);
    // chase camera
    const yaw = this.camYaw + this.yawOff;
    const fx = Math.cos(yaw), fz = Math.sin(yaw);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const cam = this.camera;
    // pull the camera in when the full chase distance would put it inside a building
    let want = this.dist;
    for (let i = 0; i < 9; i++) {
      if (1.6 + sp * want >= this.roofAt(this.boatPos.x - fx * cp * want, this.boatPos.z - fz * cp * want) + 1) break;
      want = Math.max(5, want * 0.8);
    }
    this.eff += (want - this.eff) * (1 - Math.exp(-dt / (want < this.eff ? 0.12 : 0.9)));
    const dist = this.eff;
    const ahead = dist * 0.42;
    const aim = this.focus ?? new THREE.Vector3(this.boatPos.x + fx * ahead, 1.5 + dist * 0.1, this.boatPos.z + fz * ahead);
    let cy = 1.6 + sp * dist;
    const cxp = this.boatPos.x - fx * cp * dist, czp = this.boatPos.z - fz * cp * dist;
    const roof = this.roofAt(cxp, czp) + 0.8;
    if (cy < roof) cy = roof;
    cam.position.set(cxp, cy, czp);
    cam.lookAt(aim);
    for (const m of this.mats) m.uniforms.uTime.value = this.time;
    this.renderer.render(this.scene, cam);
    this.onFrame?.();
  };

  private roofAt(x: number, z: number) {
    const { w, h, height } = this.world;
    let top = 0;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const xi = Math.floor(x) + dx, zi = Math.floor(z) + dz;
        if (xi >= 0 && zi >= 0 && xi < w && zi < h) top = Math.max(top, height[zi * w + xi]);
      }
    return LAND_Y + top * PLATE;
  }

  /** Screen position of a world point (CSS pixels inside the host), or null when it is behind the camera. */
  project(x: number, y: number, z: number): { x: number; y: number; d: number } | null {
    const v = new THREE.Vector3(x, y, z);
    const d = v.distanceTo(this.camera.position);
    v.project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x * 0.5 + 0.5) * this.host.clientWidth, y: (-v.y * 0.5 + 0.5) * this.host.clientHeight, d };
  }
  get boatXZ(): [number, number] {
    return [this.boatPos.x, this.boatPos.z];
  }
  get forward(): [number, number] {
    return [Math.cos(this.heading), Math.sin(this.heading)];
  }

  /** What is under the pointer: march the view ray through the height grid and the bridge boxes. */
  pick(clientX: number, clientY: number): Selection | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position, d = ndc.sub(o).normalize();
    const { w, h, height, bid } = this.world;
    let t = 0;
    for (let i = 0; i < 6000; i++) {
      t += t < 150 ? 0.2 : t < 600 ? 0.4 : 0.8;
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y < 0 || t > 3000) break;
      const xi = Math.floor(x), zi = Math.floor(z);
      if (xi >= 0 && zi >= 0 && xi < w && zi < h) {
        const hh = height[zi * w + xi];
        if (hh && y <= LAND_Y + hh * PLATE) return { kind: 'building', id: bid[zi * w + xi] };
      }
      if (y < 20)
        for (const b of this.boxes) {
          const rx = x - b.cx, rz = z - b.cz;
          const u = rx * b.ax + rz * b.az;
          if (u < b.u0 || u > b.u1 || y > b.top) continue;
          if (Math.abs(-rx * b.az + rz * b.ax) <= b.halfW) return { kind: 'bridge', index: b.index };
        }
      if (y < LAND_Y + 15 && Math.abs(z - this.wheelPos[1]) < 0.8 && Math.hypot(x - this.wheelPos[0], y - (LAND_Y + 7.8)) < 7.4) {
        const k = this.world.pois.findIndex((p) => p.name === 'Navy Pier');
        if (k >= 0) return { kind: 'poi', index: k };
      }
      if (y <= LAND_Y && xi >= 0 && zi >= 0 && xi < w && zi < h && this.world.ground[zi * w + xi] > 2) break; // hit the street
    }
    return null;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.mats) m.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
