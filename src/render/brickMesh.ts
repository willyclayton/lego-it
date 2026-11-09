import * as THREE from 'three';
import { color as legoColor } from '../lego/colors';
import { footprint, part } from '../lego/parts';
import type { Placement } from '../lego/types';
import { PLATE, partGeo } from './geometry';

/**
 * All bricks of a model merged into a handful of draw calls:
 *   - opaque mesh, transparent mesh, hard edge lines, conditional (silhouette) lines.
 * Every vertex carries a `brickId`. A float texture holds per-brick state:
 *   rgb = world offset (used for drop-in animation / exploded sub-assemblies)
 *   a   = state: < 0 hidden, 0 normal, (0..1] highlight amount
 * so showing, hiding and animating any brick is just a texel write.
 */

export type RenderStyle = 'instructions' | 'realistic';

const TEX_W = 256;

export function brickMatrix(p: Placement, out = new THREE.Matrix4()) {
  const def = part(p.part);
  const [fx, fz] = footprint(def, p.rot);
  const center = new THREE.Matrix4().makeTranslation(-def.w / 2, 0, -def.l / 2);
  const rot = new THREE.Matrix4().makeRotationY((p.rot * Math.PI) / 2);
  const place = new THREE.Matrix4().makeTranslation(p.x + fx / 2, p.y * PLATE, p.z + fz / 2);
  return out.copy(place).multiply(rot).multiply(center);
}

export function brickWorldBox(p: Placement, out = new THREE.Box3()) {
  return out.copy(partGeo(p.part).geometry.boundingBox!).applyMatrix4(brickMatrix(p));
}

const linear = (hex: string) => new THREE.Color(hex); // Color() converts sRGB hex → linear working space

/* ------------------------------ shader patching ------------------------------ */

const VERT_HEAD = /* glsl */ `
attribute float brickId;
uniform sampler2D uBrickData;
uniform float uLift;
varying float vHighlight;
vec4 brickState() {
  int id = int(brickId + 0.5);
  return texelFetch(uBrickData, ivec2(id % ${TEX_W}, id / ${TEX_W}), 0);
}
`;
const VERT_BODY = /* glsl */ `
vec4 bState = brickState();
transformed += bState.xyz;
vHighlight = clamp(bState.w, 0.0, 1.0);
if (bState.w < -0.5) transformed = vec3(0.0, -10000.0, 0.0);
`;

function patch(mat: THREE.Material, uniforms: { uBrickData: THREE.IUniform }, highlight: boolean) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBrickData = uniforms.uBrickData;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_HEAD}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERT_BODY}`);
    if (highlight) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHighlight;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), vHighlight * 0.55);',
        );
    }
  };
  mat.customProgramCacheKey = () => `brick-${mat.type}-${highlight}`;
}

/* ------------------------------ line material ------------------------------ */

function lineMaterial(uniforms: { uBrickData: THREE.IUniform }, conditional: boolean) {
  return new THREE.ShaderMaterial({
    uniforms: { uBrickData: uniforms.uBrickData, uOpacity: { value: 1 }, uHalfH: { value: 400 } },
    transparent: false,
    depthWrite: true,
    vertexShader: /* glsl */ `
      ${VERT_HEAD}
      attribute vec3 color;
      attribute vec3 fill;
      uniform float uHalfH;
      ${conditional ? 'attribute vec3 control0; attribute vec3 control1; attribute vec3 direction;' : ''}
      varying vec3 vColor;
      varying float vDiscard;
      void main() {
        vec4 bState = brickState();
        vec3 off = bState.xyz;
        vDiscard = bState.w < -0.5 ? 1.0 : 0.0;
        vec4 mvPosition = modelViewMatrix * vec4(position + off, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        // How many pixels is one stud here? Fade outlines toward a darker shade of the
        // part's own color when the model is small on screen, so it doesn't turn black.
        bool persp = projectionMatrix[2][3] < -0.5;
        float pxPerStud = projectionMatrix[1][1] * uHalfH / (persp ? max(0.001, -mvPosition.z) : 1.0);
        float k = smoothstep(7.0, 22.0, pxPerStud);
        vColor = mix(fill * 0.62, color, k);
        ${
          conditional
            ? `
        // LDraw conditional line: draw only if both control points project to the same side of the line.
        vec4 c0 = projectionMatrix * modelViewMatrix * vec4(control0 + off, 1.0);
        vec4 c1 = projectionMatrix * modelViewMatrix * vec4(control1 + off, 1.0);
        vec4 p1 = projectionMatrix * modelViewMatrix * vec4(position + direction + off, 1.0);
        vec2 a = gl_Position.xy / gl_Position.w;
        vec2 b = p1.xy / p1.w;
        vec2 d = b - a;
        vec2 n = vec2(-d.y, d.x);
        float s0 = dot(c0.xy / c0.w - a, n);
        float s1 = dot(c1.xy / c1.w - a, n);
        if (s0 * s1 < 0.0) vDiscard = 1.0;`
            : ''
        }
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vDiscard;
      void main() {
        if (vDiscard > 0.5) discard;
        gl_FragColor = vec4(vColor, uOpacity);
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------ BrickMesh ------------------------------ */

export class BrickMesh {
  readonly group = new THREE.Group();
  readonly count: number;
  readonly data: Float32Array;
  readonly texture: THREE.DataTexture;
  private uniforms: { uBrickData: THREE.IUniform };
  private opaque: THREE.Mesh;
  private trans: THREE.Mesh | null = null;
  private lines: THREE.LineSegments;
  private condLines: THREE.LineSegments;
  private mats: Record<RenderStyle, { opaque: THREE.Material; trans: THREE.Material }>;
  readonly bricks: Placement[];
  /** Brick world bounds (at rest). */
  readonly boxes: THREE.Box3[];
  private style: RenderStyle = 'instructions';

  constructor(bricks: Placement[]) {
    this.bricks = bricks;
    this.count = bricks.length;
    const rows = Math.max(1, Math.ceil(this.count / TEX_W));
    this.data = new Float32Array(TEX_W * rows * 4);
    this.texture = new THREE.DataTexture(this.data, TEX_W, rows, THREE.RGBAFormat, THREE.FloatType);
    this.texture.needsUpdate = true;
    this.uniforms = { uBrickData: { value: this.texture } };
    this.boxes = bricks.map((b) => brickWorldBox(b));

    const op = this.buildMesh(bricks.map((b, i) => [b, i] as const).filter(([b]) => !legoColor(b.color).trans));
    const tr = this.buildMesh(bricks.map((b, i) => [b, i] as const).filter(([b]) => legoColor(b.color).trans));
    const { hard, cond } = this.buildLines();

    const mk = (style: RenderStyle) => {
      const opaque =
        style === 'realistic'
          ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25 })
          : new THREE.MeshLambertMaterial({ vertexColors: true });
      const trans =
        style === 'realistic'
          ? new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false })
          : new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
      for (const m of [opaque, trans]) {
        // push fills back a little so the outline lines never z-fight with their own faces
        m.polygonOffset = true;
        m.polygonOffsetFactor = 1;
        m.polygonOffsetUnits = 1;
        patch(m, this.uniforms, true);
      }
      return { opaque, trans };
    };
    this.mats = { instructions: mk('instructions'), realistic: mk('realistic') };

    this.opaque = new THREE.Mesh(op, this.mats.instructions.opaque);
    this.opaque.frustumCulled = false;
    this.opaque.castShadow = true;
    this.opaque.receiveShadow = true;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patch(depth, this.uniforms, false);
    this.opaque.customDepthMaterial = depth;
    this.group.add(this.opaque);
    if (tr.attributes.position.count > 0) {
      this.trans = new THREE.Mesh(tr, this.mats.instructions.trans);
      this.trans.frustumCulled = false;
      this.trans.renderOrder = 2;
      this.group.add(this.trans);
    }
    this.lines = new THREE.LineSegments(hard, lineMaterial(this.uniforms, false));
    this.condLines = new THREE.LineSegments(cond, lineMaterial(this.uniforms, true));
    this.lines.frustumCulled = false;
    this.condLines.frustumCulled = false;
    this.lines.renderOrder = 1;
    this.condLines.renderOrder = 1;
    const size = new THREE.Vector2();
    for (const l of [this.lines, this.condLines]) {
      l.onBeforeRender = (renderer) => {
        renderer.getDrawingBufferSize(size);
        (l.material as THREE.ShaderMaterial).uniforms.uHalfH.value = size.y / 2;
      };
    }
    this.group.add(this.lines, this.condLines);
    this.setAll(-1);
  }

  private buildMesh(items: (readonly [Placement, number])[]) {
    let total = 0;
    for (const [b] of items) total += partGeo(b.part).geometry.attributes.position.count;
    const pos = new Float32Array(total * 3);
    const nor = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const ids = new Float32Array(total);
    const m = new THREE.Matrix4();
    const nm = new THREE.Matrix3();
    const v = new THREE.Vector3();
    let o = 0;
    for (const [b, id] of items) {
      const g = partGeo(b.part).geometry;
      brickMatrix(b, m);
      nm.getNormalMatrix(m);
      const c = linear(legoColor(b.color).hex);
      const P = g.attributes.position;
      const N = g.attributes.normal;
      for (let i = 0; i < P.count; i++, o++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m);
        pos[o * 3] = v.x; pos[o * 3 + 1] = v.y; pos[o * 3 + 2] = v.z;
        v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
        nor[o * 3] = v.x; nor[o * 3 + 1] = v.y; nor[o * 3 + 2] = v.z;
        col[o * 3] = c.r; col[o * 3 + 1] = c.g; col[o * 3 + 2] = c.b;
        ids[o] = id;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('brickId', new THREE.BufferAttribute(ids, 1));
    geo.computeBoundingSphere();
    return geo;
  }

  private buildLines() {
    let nh = 0;
    let nc = 0;
    for (const b of this.bricks) {
      const g = partGeo(b.part);
      nh += g.lines.length / 3;
      nc += g.cond.length / 6; // 2 verts per segment, 12 floats per segment
    }
    const hp = new Float32Array(nh * 3), hc = new Float32Array(nh * 3), hf = new Float32Array(nh * 3), hi = new Float32Array(nh);
    const cp = new Float32Array(nc * 3), cc = new Float32Array(nc * 3), cf = new Float32Array(nc * 3), ci = new Float32Array(nc);
    const c0 = new Float32Array(nc * 3), c1 = new Float32Array(nc * 3), cd = new Float32Array(nc * 3);
    const m = new THREE.Matrix4();
    const v = new THREE.Vector3(), a = new THREE.Vector3(), b2 = new THREE.Vector3(), k0 = new THREE.Vector3(), k1 = new THREE.Vector3();
    let oh = 0, oc = 0;
    this.bricks.forEach((b, id) => {
      const g = partGeo(b.part);
      brickMatrix(b, m);
      const col = legoColor(b.color);
      const ec = linear(col.edge);
      const fc = linear(col.hex);
      for (let i = 0; i < g.lines.length; i += 3, oh++) {
        v.set(g.lines[i], g.lines[i + 1], g.lines[i + 2]).applyMatrix4(m);
        hp.set([v.x, v.y, v.z], oh * 3);
        hc.set([ec.r, ec.g, ec.b], oh * 3);
        hf.set([fc.r, fc.g, fc.b], oh * 3);
        hi[oh] = id;
      }
      for (let i = 0; i < g.cond.length; i += 12) {
        a.set(g.cond[i], g.cond[i + 1], g.cond[i + 2]).applyMatrix4(m);
        b2.set(g.cond[i + 3], g.cond[i + 4], g.cond[i + 5]).applyMatrix4(m);
        k0.set(g.cond[i + 6], g.cond[i + 7], g.cond[i + 8]).applyMatrix4(m);
        k1.set(g.cond[i + 9], g.cond[i + 10], g.cond[i + 11]).applyMatrix4(m);
        for (const [p, q] of [[a, b2], [b2, a]] as const) {
          cp.set([p.x, p.y, p.z], oc * 3);
          cd.set([q.x - p.x, q.y - p.y, q.z - p.z], oc * 3);
          c0.set([k0.x, k0.y, k0.z], oc * 3);
          c1.set([k1.x, k1.y, k1.z], oc * 3);
          cc.set([ec.r, ec.g, ec.b], oc * 3);
          cf.set([fc.r, fc.g, fc.b], oc * 3);
          ci[oc] = id;
          oc++;
        }
      }
    });
    const hard = new THREE.BufferGeometry();
    hard.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    hard.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    hard.setAttribute('fill', new THREE.BufferAttribute(hf, 3));
    hard.setAttribute('brickId', new THREE.BufferAttribute(hi, 1));
    const cond = new THREE.BufferGeometry();
    cond.setAttribute('position', new THREE.BufferAttribute(cp, 3));
    cond.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    cond.setAttribute('fill', new THREE.BufferAttribute(cf, 3));
    cond.setAttribute('brickId', new THREE.BufferAttribute(ci, 1));
    cond.setAttribute('control0', new THREE.BufferAttribute(c0, 3));
    cond.setAttribute('control1', new THREE.BufferAttribute(c1, 3));
    cond.setAttribute('direction', new THREE.BufferAttribute(cd, 3));
    return { hard, cond };
  }

  setStyle(style: RenderStyle, edges = style === 'instructions') {
    this.style = style;
    this.opaque.material = this.mats[style].opaque;
    if (this.trans) this.trans.material = this.mats[style].trans;
    this.lines.visible = edges;
    this.condLines.visible = edges;
    const op = style === 'realistic' ? 0.35 : 1;
    for (const l of [this.lines, this.condLines]) {
      const m = l.material as THREE.ShaderMaterial;
      m.uniforms.uOpacity.value = op;
      m.transparent = op < 1;
    }
  }

  getStyle() {
    return this.style;
  }

  /** state: -1 hidden, 0 visible, (0..1] highlighted */
  set(i: number, state: number, dx = 0, dy = 0, dz = 0) {
    const o = i * 4;
    this.data[o] = dx;
    this.data[o + 1] = dy;
    this.data[o + 2] = dz;
    this.data[o + 3] = state;
  }

  setAll(state: number) {
    for (let i = 0; i < this.count; i++) this.set(i, state);
    this.commit();
  }

  commit() {
    this.texture.needsUpdate = true;
  }

  /** Bounds of bricks whose state passes `filter` (at rest position). */
  bounds(filter: (i: number) => boolean, out = new THREE.Box3()) {
    out.makeEmpty();
    for (let i = 0; i < this.count; i++) if (filter(i)) out.union(this.boxes[i]);
    return out;
  }

  /** Brick id under a raycast hit, ignoring hidden bricks. */
  pick(raycaster: THREE.Raycaster): number | null {
    const hits = raycaster.intersectObjects([this.opaque, ...(this.trans ? [this.trans] : [])], false);
    for (const h of hits) {
      const geo = (h.object as THREE.Mesh).geometry;
      const id = geo.attributes.brickId.getX(h.face!.a);
      const o = id * 4;
      if (this.data[o + 3] >= -0.5 && this.data[o] === 0 && this.data[o + 1] === 0 && this.data[o + 2] === 0) return id;
    }
    return null;
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    for (const s of Object.values(this.mats)) {
      s.opaque.dispose();
      s.trans.dispose();
    }
    (this.lines.material as THREE.Material).dispose();
    (this.condLines.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
