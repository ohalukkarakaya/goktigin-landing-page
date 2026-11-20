// Göktigin landing: a 3D scene drawn as ASCII, where the characters come from
// our own source code. Under the cursor a lens "compiles" them into the real render.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CODE, EMBLEM } from './data.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchFirst = matchMedia('(hover: none)').matches;

/* ── Antalya clock in the ribbon ─────────────────────── */
const clockEl = document.getElementById('clock');
const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const tickClock = () => { clockEl.textContent = clockFmt.format(new Date()); };
tickClock();
setInterval(tickClock, 15000);

main().catch((err) => {
  console.warn('ASCII stage disabled:', err);
  document.getElementById('stage')?.remove();
});

async function main() {
  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');

  await Promise.race([
    Promise.all([
      document.fonts.load('700 20px "JetBrains Mono"'),
      document.fonts.load('500 20px "JetBrains Mono"'),
      document.fonts.load('700 100px "Qanelas"'),
    ]),
    new Promise((r) => setTimeout(r, 2500)),
  ]);

  const [aomImg, chaputImg, benekImg] = await Promise.all([
    loadImage('assets/screens/artofmenu.webp'),
    loadImage('assets/screens/chaput.webp'),
    loadImage('assets/screens/benek.jpg'),
  ]);

  /* ── sizes ─────────────────────────────────────────── */
  let W = innerWidth, H = innerHeight;
  let dpr = Math.min(devicePixelRatio || 1, 2);
  const CELL_CSS = touchFirst || W < 820 ? 7 : 8;
  let cellW = 0, cellH = 0;

  /* ── scene ─────────────────────────────────────────── */
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 50);
  camera.position.set(0, 0, 7);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const lamp = new THREE.PointLight(0xffe2c4, 9, 9, 1.6);
  scene.add(lamp);

  // the device
  const device = new THREE.Group();
  scene.add(device);
  const DW = 1, DH = 2.05, DD = 0.1;
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(DW, DH, DD, 6, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.85, roughness: 0.3 }),
  );
  device.add(body);

  const SW = 0.92, SH = 1.97;
  // every screen has two faces: the real UI (seen through the lens) and a line drawing of it
  // that the ASCII pass turns into characters
  const screens = {
    artofmenu: screenTextures((g, w, h) => drawCover(g, aomImg, w, h), drawQr),
    chaput: screenTextures((g, w, h) => drawCover(g, chaputImg, w, h), drawTree),
    benek: screenTextures((g, w, h) => drawCover(g, benekImg, w, h), drawPaw),
  };
  let current = 'artofmenu';
  const screenMat = new THREE.MeshBasicMaterial({ map: screens.artofmenu.ascii, transparent: true, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
  screen.position.z = DD / 2 + 0.002;
  device.add(screen);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(SW, SH),
    new THREE.MeshBasicMaterial({ map: canvasTexture(screenCanvas(drawBack, false)), transparent: true, toneMapped: false }),
  );
  back.position.z = -DD / 2 - 0.002;
  back.rotation.y = Math.PI;
  device.add(back);

  // the emblem, as voxels
  const emblem = new THREE.Group();
  scene.add(emblem);
  const VS = 0.17;
  const vox = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05 }),
    EMBLEM.length,
  );
  emblem.add(vox);
  const voxBase = [], voxFrom = [], voxDelay = [];
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3();
  EMBLEM.forEach(([x, y, h, hex, alpha], i) => {
    const p = new THREE.Vector3((x - 5) * VS, -(y + h / 2 - 5.75) * VS, 0);
    voxBase.push({ p, h });
    const dir = new THREE.Vector3(Math.sin(i * 12.9898) , Math.cos(i * 78.233), Math.sin(i * 3.7) * 0.6).normalize();
    voxFrom.push(dir.multiplyScalar(2.2 + (i % 5) * 0.35));
    voxDelay.push(Math.min(p.length() / 1.2, 1) * 0.45);
    vox.setColorAt(i, new THREE.Color(hex).multiplyScalar(alpha * 1.6));
  });
  vox.instanceColor.needsUpdate = true;

  // the hero: our star, with the products in orbit around it
  const orbit = new THREE.Group();
  scene.add(orbit);
  const ringMats = [0x46413b, 0x2e2b27].map((c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true }));
  const R1 = 1.45, R2 = 1.85;
  // dotted rings: beads read as a dotted line in the character grid
  for (const [R, n, size, mat] of [[R1, 72, 0.05, ringMats[0]], [R2, 110, 0.035, ringMats[1]]]) {
    const beads = new THREE.InstancedMesh(new THREE.BoxGeometry(size, size, size), mat, n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      tmpM.makeTranslation(Math.cos(a) * R, Math.sin(a) * R, 0);
      beads.setMatrixAt(i, tmpM);
    }
    orbit.add(beads);
  }
  // three satellites, one per product, in the emblem's own colours
  const sats = [[0xfbab02, R1, 0.0, 0.2], [0xf2361c, R1, 2.3, 0.2], [0xece6dc, R2, 4.1, -0.13]].map(([col, R, phase, speed]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true }));
    orbit.add(m);
    return { m, R, phase, speed };
  });

  /* ── ASCII pass ────────────────────────────────────── */
  // Performance: the scene is rendered into a small target (a few texels per character cell),
  // a cell pass decides each character once, and the per-pixel pass only stamps glyphs.
  // The full-resolution "real" render exists only while the lens is open.
  const SUB = 3; // scene texels per cell, each axis
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const rtReal = new THREE.WebGLRenderTarget(1, 1, { samples: 2, type: THREE.HalfFloatType });
  const rtCells = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  const codeTex = buildCodeTexture();
  let atlas = null;

  const fullscreen = /* glsl */`
    out vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `;
  const common = /* glsl */`
    precision highp float;
    const vec3 BG  = vec3(0.043, 0.039, 0.035);
    const vec3 INK = vec3(0.925, 0.902, 0.863);
    const vec3 RED = vec3(0.949, 0.212, 0.110);
    const vec3 YEL = vec3(0.984, 0.671, 0.008);
    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    vec3 srgb(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  `;

  // one fragment per character cell: rgb = ink (already multiplied by its strength), a = glyph
  const cellMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tScene: { value: rt.texture },
      tCode: { value: codeTex },
      uGrid: { value: new THREE.Vector2(1, 1) },   // cells, x/y
      uSpan: { value: new THREE.Vector2(1, 1) },   // uv size of one cell
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uScramble: { value: 1 },
    },
    vertexShader: fullscreen,
    fragmentShader: common + /* glsl */`
      uniform sampler2D tScene, tCode;
      uniform vec2 uGrid, uSpan;
      uniform float uTime, uScroll, uScramble;
      in vec2 vUv;
      out vec4 fragColor;
      // " .:-=+*#%@" as atlas indices (charCode - 32)
      const float RAMP[10] = float[10](0., 14., 26., 13., 29., 11., 10., 3., 5., 32.);
      vec3 sceneAt(vec2 uv) { return srgb(texture(tScene, uv).rgb); }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy);
        vec2 cuv = (cell + 0.5) * uSpan;
        vec2 q = uSpan * 0.25;
        vec3 c = (sceneAt(cuv + vec2(-q.x, -q.y)) + sceneAt(cuv + vec2(q.x, -q.y))
                + sceneAt(cuv + vec2(-q.x,  q.y)) + sceneAt(cuv + vec2(q.x,  q.y))) * 0.25;
        float L = luma(c);
        float h = hash(cell);

        float lr = luma(sceneAt(cuv + vec2(uSpan.x, 0.0))), ll = luma(sceneAt(cuv - vec2(uSpan.x, 0.0)));
        float lu = luma(sceneAt(cuv + vec2(0.0, uSpan.y))), ld = luma(sceneAt(cuv - vec2(0.0, uSpan.y)));
        float gx = lr - ll, gy = lu - ld;
        float mag = length(vec2(gx, gy));
        float lmin = min(min(lr, ll), min(lu, ld));

        float g = 0.0, a = 0.0;
        vec3 col = INK;
        float mx = max(c.r, max(c.g, c.b));
        float sat = mx - min(c.r, min(c.g, c.b));

        if (mag > 0.12 && lmin < 0.045 && L > 0.12) {
          // strokes only on silhouettes against the dark
          float ax = abs(gx), ay = abs(gy);
          if (ax > ay * 2.2) g = 92.0;            // |
          else if (ay > ax * 2.2) g = 13.0;       // -
          else g = gx * gy > 0.0 ? 60.0 : 15.0;   // \ or /
          col = mix(INK, c / max(mx, 1e-3), smoothstep(0.1, 0.42, sat));
          a = 0.65 + 0.5 * min(mag, 1.0);
        } else if (L > 0.03) {
          // dark falloff dithered with the ramp; brighter cells are our source code,
          // its brightness carrying the picture like a text portrait
          float r = clamp(pow(L, 0.9), 0.0, 0.999);
          g = RAMP[int(r * 10.0)];
          float row = mod(floor(uScroll) - cell.y, 256.0);
          vec2 cc = vec2(mod(cell.x, 256.0), row < 0.0 ? row + 256.0 : row);
          float code = floor(texture(tCode, (cc + 0.5) / 256.0).r * 255.0 + 0.5);
          if (L > 0.16 && code > 0.5) g = code;
          col = mix(INK, c / max(mx, 1e-3), smoothstep(0.1, 0.4, sat));
          // colourful cells (the emblem's reds) glow by their value, not their luma
          float s = smoothstep(0.03, 1.0, mix(L, mx * 0.92, smoothstep(0.1, 0.4, sat)));
          a = 0.14 + 0.95 * pow(s, 1.6);
        } else if (h > 0.986) {
          // dust: a few dots drifting in the dark
          g = 14.0;
          a = 0.08 + 0.14 * step(0.5, hash(cell + floor(uTime * 0.4 + h * 9.0)));
        }

        // transitions: characters scramble before they settle
        if (uScramble > 0.001 && L > 0.02 && hash(cell + 7.1) < uScramble * 0.85) {
          float t = floor(uTime * 22.0);
          g = 1.0 + floor(hash(cell + t) * 93.0);
          col = mix(RED, YEL, hash(cell - t));
          a = 0.95;
        }
        fragColor = vec4(clamp(col * a, 0.0, 1.0), g / 255.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });

  // per pixel: stamp the glyph, then the lens
  const post = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      tCells: { value: rtCells.texture },
      tReal: { value: rtReal.texture },
      tAtlas: { value: null },
      uCell: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2(-999, -999) },
      uLens: { value: 0 },
      uDpr: { value: dpr },
    },
    vertexShader: fullscreen,
    fragmentShader: common + /* glsl */`
      uniform sampler2D tCells, tReal, tAtlas;
      uniform vec2 uCell, uMouse;
      uniform float uLens, uDpr;
      in vec2 vUv;
      out vec4 fragColor;

      void main() {
        vec2 frag = gl_FragCoord.xy;
        vec2 cell = floor(frag / uCell);
        vec2 inC = fract(frag / uCell);
        vec4 d0 = texelFetch(tCells, ivec2(cell), 0);
        float g = floor(d0.a * 255.0 + 0.5);
        float m = g > 0.5 ? texture(tAtlas, vec2((g + inC.x) / 95.0, inC.y)).a : 0.0;
        vec3 ink = d0.rgb * m;
        vec3 outc = BG + ink;

        float R = uLens;
        if (R >= 1.0) {
          float d = distance(frag, uMouse);
          float edge = R + 80.0 * uDpr;
          if (d < edge) {
            float inside = 1.0 - smoothstep(R - 1.5 * uDpr, R, d);
            float halo = (1.0 - inside) * smoothstep(edge, R, d);
            outc = mix(outc, BG + ink * vec3(1.25, 0.62, 0.45), halo * 0.7);
            if (inside > 0.0) outc = mix(outc, max(srgb(texture(tReal, vUv).rgb), BG), inside);
            outc = mix(outc, RED, 1.0 - smoothstep(0.0, 1.2 * uDpr, abs(d - R)));
          }
        }
        fragColor = vec4(outc, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
  });
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  const passScene = (mat) => {
    const sc = new THREE.Scene();
    const mesh = new THREE.Mesh(tri, mat);
    mesh.frustumCulled = false;
    sc.add(mesh);
    return sc;
  };
  const cellScene = passScene(cellMat);
  const postScene = passScene(post);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* ── layout ────────────────────────────────────────── */
  const layout = { x: 0, y: 0, s: 1, os: 1, yaw: 0 };
  function resize() {
    W = innerWidth; H = innerHeight;
    const nextDpr = Math.min(devicePixelRatio || 1, 2);
    const dprChanged = nextDpr !== dpr || !atlas;
    dpr = nextDpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();

    cellW = Math.round(CELL_CSS * dpr);
    cellH = Math.round(CELL_CSS * 1.75 * dpr);
    if (dprChanged) {
      atlas?.dispose();
      atlas = buildAtlas(cellW, cellH);
      post.uniforms.tAtlas.value = atlas;
    }
    post.uniforms.uCell.value.set(cellW, cellH);
    post.uniforms.uDpr.value = dpr;
    const cols = Math.ceil(bw / cellW), rows = Math.ceil(bh / cellH);
    rtCells.setSize(cols, rows);
    rt.setSize(cols * SUB, rows * SUB);
    const realDpr = Math.min(dpr, 1.5);
    rtReal.setSize(Math.round(W * realDpr), Math.round(H * realDpr));
    cellMat.uniforms.uGrid.value.set(cols, rows);
    // a cell's uv span in the scene, matching where the glyph lands on screen
    cellMat.uniforms.uSpan.value.set(cellW / bw, cellH / bh);

    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (W > 820) {
      layout.mobile = false;
      layout.x = 0.4 * halfW; layout.y = -0.05; layout.s = Math.min((halfH * 1.36) / DH, (halfW * 0.62) / 1.1); layout.yaw = -0.28; layout.os = Math.min(layout.s * 0.82, ((halfW - layout.x) * 0.9) / R2);
    } else {
      // phones: every section keeps a box at its top for the 3D object (see styles.css),
      // and the object scrolls with that section instead of sitting under the text
      layout.mobile = true;
      layout.halfH = halfH;
      layout.boxTop = Math.max(76, H * 0.07);
      layout.boxH = H * 0.38;
      const boxWorld = (layout.boxH / H) * 2 * halfH;
      layout.s = Math.min((boxWorld * 0.95) / DH, (halfW * 2 * 0.5) / DW);
      layout.x = 0; layout.yaw = 0;
      layout.os = Math.min(layout.s * 0.82, (halfW * 0.94) / R2);
    }
  }
  resize();
  addEventListener('resize', resize);

  /* ── input ─────────────────────────────────────────── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const lens = { x: -999, y: -999, r: 0, target: 0 };
  let lensTimer = 0;
  const LENS_R = touchFirst ? 92 : 118;

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer.tx = (e.clientX / W) * 2 - 1;
    pointer.ty = -((e.clientY / H) * 2 - 1);
    lens.x = e.clientX; lens.y = e.clientY;
    lens.target = LENS_R;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { lens.target = 0; });
  addEventListener('blur', () => { lens.target = 0; });

  const onTouch = (e) => {
    const t = e.touches[0];
    if (!t) return;
    lens.x = t.clientX; lens.y = t.clientY;
    lens.target = LENS_R;
    clearTimeout(lensTimer);
  };
  addEventListener('touchstart', onTouch, { passive: true });
  addEventListener('touchmove', onTouch, { passive: true });
  addEventListener('touchend', () => {
    clearTimeout(lensTimer);
    lensTimer = setTimeout(() => { lens.target = 0; }, 450);
    askForTilt();
  }, { passive: true });

  // tilt on phones
  let tiltAsked = false;
  function listenTilt() {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      pointer.tx = THREE.MathUtils.clamp(e.gamma / 28, -1, 1);
      pointer.ty = THREE.MathUtils.clamp((e.beta - 50) / 28, -1, 1);
    }, { passive: true });
  }
  function askForTilt() {
    if (tiltAsked || !touchFirst) return;
    tiltAsked = true;
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().then((s) => { if (s === 'granted') listenTilt(); }).catch(() => {});
    } else if (D) listenTilt();
  }
  if (touchFirst && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    tiltAsked = true;
    listenTilt();
  }

  /* ── scenes driven by scroll ───────────────────────── */
  const state = { scene: 'hero', device: 0, emblem: 0, orbit: 0, devT: 0, embT: 1, orbT: 1 };
  let spin = null; // { t0, to, swapped }
  function setScene(name) {
    if (name === state.scene) return;
    const prev = state.scene;
    state.scene = name;
    state.orbT = name === 'hero' ? 1 : 0;
    if (name === 'hero' || name === 'emblem') { state.devT = 0; state.embT = 1; return; }
    state.devT = 1; state.embT = 0;
    if (prev === 'emblem' || prev === 'hero' || state.device < 0.3) { current = name; spin = null; return; }
    spin = { t0: performance.now(), to: name, swapped: false };
  }
  let activeEl = document.querySelector('[data-scene]');
  let anchored = false;
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { activeEl = en.target; setScene(en.target.dataset.scene); }
  }, { rootMargin: '-45% 0px -45% 0px' });
  document.querySelectorAll('[data-scene]').forEach((el) => io.observe(el));

  /* ── loop ──────────────────────────────────────────── */
  const t0 = performance.now();
  let last = t0;
  // ?still renders a settled frame right away (used for screenshots)
  const still = new URLSearchParams(location.search).has('still');
  let intro = still ? 1 : 0;
  if (still) { state.emblem = 1; state.orbit = 1; }
  let running = true;
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) { last = performance.now(); requestAnimationFrame(frame); }
  });

  function frame(now) {
    if (!running) return;
    // 30 fps is plenty for characters and halves the GPU work
    if (now - last < 30) { requestAnimationFrame(frame); return; }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = reduced ? 0 : (now - t0) / 1000;
    const k = (rate) => 1 - Math.exp(-rate * dt);

    intro = Math.min(1, intro + dt / 1.4);
    pointer.x += (pointer.tx - pointer.x) * k(4);
    pointer.y += (pointer.ty - pointer.y) * k(4);
    state.device += (state.devT - state.device) * k(5);
    state.emblem += (state.embT - state.emblem) * k(3.2);
    state.orbit += (state.orbT - state.orbit) * k(3);
    lens.r += (lens.target - lens.r) * k(10);

    // screen swap with a full turn
    let extra = 0, scramble = Math.pow(1 - intro, 1.6);
    if (spin) {
      const p = Math.min(1, (now - spin.t0) / (reduced ? 400 : 1100));
      extra = reduced ? 0 : easeInOut(p) * Math.PI * 2;
      if (p >= 0.5 && !spin.swapped) { current = spin.to; spin.swapped = true; }
      scramble = Math.max(scramble, Math.pow(Math.sin(Math.PI * p), 0.8) * 0.75);
      if (p >= 1) spin = null;
    }
    scramble = Math.max(scramble, Math.sin(Math.PI * Math.min(state.emblem, 1)) * 0.35);

    if (layout.mobile && activeEl) {
      const cy = activeEl.getBoundingClientRect().top + layout.boxTop + layout.boxH / 2;
      const ty = layout.halfH * (1 - (2 * cy) / H);
      layout.y = anchored ? layout.y + (ty - layout.y) * k(9) : ty;
      anchored = true;
    }

    const dv = easeOut(Math.max(0, state.device) * intro);
    device.visible = dv > 0.01;
    device.scale.setScalar(layout.s * (0.6 + 0.4 * dv));
    device.position.set(layout.x, layout.y + Math.sin(t * 0.8) * 0.04 - (1 - dv) * 0.6, 0);
    device.rotation.set(
      -pointer.y * 0.28 + Math.sin(t * 0.5) * 0.04,
      layout.yaw + pointer.x * 0.5 + Math.sin(t * 0.35) * 0.16 + extra,
      Math.sin(t * 0.4) * 0.02,
    );
    body.material.opacity = 1;
    device.traverse((o) => { if (o.material) o.material.visible = dv > 0.01; });
    if (dv < 0.98) {
      device.children.forEach((o) => { o.material.transparent = true; o.material.opacity = dv; });
    } else {
      body.material.transparent = false;
      body.material.opacity = 1; screenMat.opacity = 1; back.material.opacity = 1;
    }

    // emblem assembles from scattered voxels
    const ev = Math.max(0, state.emblem);
    emblem.visible = ev > 0.01;
    if (emblem.visible) {
      emblem.position.set(layout.x, layout.y, 0);
      emblem.scale.setScalar(layout.s * (layout.mobile ? 0.95 : 1.25 - 0.3 * Math.max(0, Math.min(1, state.orbit))));
      emblem.rotation.set(-pointer.y * 0.3, layout.yaw * 0.6 + pointer.x * 0.6 + Math.sin(t * 0.45) * 0.35, 0);
      EMBLEM.forEach((_, i) => {
        const { p, h } = voxBase[i];
        const e = easeOut(THREE.MathUtils.clamp((ev - voxDelay[i]) / (1 - voxDelay[i] * 0.9), 0, 1));
        tmpV.copy(voxFrom[i]).multiplyScalar(1 - e).add(p);
        tmpV.z += Math.sin(t * 1.3 + i) * 0.015;
        tmpQ.setFromAxisAngle(voxFrom[i], (1 - e) * 2.5);
        tmpS.set(VS * 0.93, VS * h * 0.93, VS * 0.93).multiplyScalar(0.2 + 0.8 * e);
        tmpM.compose(tmpV, tmpQ, tmpS);
        vox.setMatrixAt(i, tmpM);
      });
      vox.instanceMatrix.needsUpdate = true;
    }

    // products in orbit around the star
    const ov = easeOut(Math.max(0, state.orbit) * intro);
    orbit.visible = ov > 0.01;
    if (orbit.visible) {
      orbit.position.set(layout.x, layout.y, 0);
      orbit.scale.setScalar(layout.os * (0.75 + 0.25 * ov));
      orbit.rotation.set(-1.16 - pointer.y * 0.18, pointer.x * 0.12, 0.2 + pointer.x * 0.06);
      ringMats[0].opacity = ov; ringMats[1].opacity = ov;
      orbit.updateMatrixWorld();
      for (const st of sats) {
        const a = st.phase + t * st.speed;
        st.m.position.set(Math.cos(a) * st.R, Math.sin(a) * st.R, 0);
        st.m.rotation.set(t, t * 0.7, 0);
        st.m.material.opacity = ov;
      }
    }

    lamp.position.set(pointer.x * 3.2, pointer.y * 2.4 + 0.5, 3);

    const cu = cellMat.uniforms;
    cu.uTime.value = t;
    cu.uScroll.value = (reduced ? 0 : t * 1.6) + scrollY / (cellH / dpr) * 0.35;
    cu.uScramble.value = scramble;
    const u = post.uniforms;
    u.uLens.value = lens.r < 1 ? 0 : lens.r * dpr;
    u.uMouse.value.set(lens.x * dpr, (H - lens.y) * dpr);

    renderer.setClearColor(0x000000, 1);
    screenMat.map = screens[current].ascii;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    if (lens.r >= 1) {
      screenMat.map = screens[current].real;
      renderer.setRenderTarget(rtReal);
      renderer.clear();
      renderer.render(scene, camera);
    }
    renderer.setRenderTarget(rtCells);
    renderer.render(cellScene, postCam);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ── helpers ───────────────────────────────────────── */
  function screenTextures(drawReal, drawSign) {
    return {
      real: canvasTexture(screenCanvas(drawReal, true)),
      ascii: canvasTexture(screenCanvas(drawSign, true)),
    };
  }

  function canvasTexture(c) {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function screenCanvas(draw, rounded) {
    const w = 540, h = Math.round(540 * (SH / SW));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.save();
    roundRect(g, 0, 0, w, h, rounded ? 58 : 66);
    g.clip();
    draw(g, w, h);
    g.restore();
    if (rounded) {
      g.fillStyle = '#050505';
      roundRect(g, w / 2 - 82, 22, 164, 46, 23);
      g.fill();
    }
    return c;
  }

  function drawBenek(g, w, h) {
    g.fillStyle = '#f3ede3';
    g.fillRect(0, 0, w, h);
    const spots = [[90, 230, 34], [400, 180, 22], [470, 420, 40], [70, 560, 18], [180, 380, 12], [360, 700, 30], [120, 900, 38], [430, 980, 20], [260, 1110, 14], [300, 260, 10]];
    g.fillStyle = '#2b2520';
    for (const [x, y, r] of spots) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2b2520';
    g.font = '700 120px "Qanelas", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('benek', w / 2, h * 0.5);
    g.font = '500 26px "JetBrains Mono", monospace';
    g.fillStyle = '#8c8379';
    g.fillText('— paused —', w / 2, h * 0.5 + 92);
  }

  function drawBack(g, w, h) {
    g.fillStyle = '#1d1a17';
    g.fillRect(0, 0, w, h);
    const s = 16, ox = w / 2 - 5.5 * s, oy = h / 2 - 5.75 * s;
    for (const [x, y, ch, hex, a] of EMBLEM) {
      g.globalAlpha = a;
      g.fillStyle = hex;
      g.fillRect(ox + x * s, oy + y * s, s, ch * s);
    }
    g.globalAlpha = 1;
  }
}

/* ── product signs: bold shapes that read well as characters ── */
const SIGN_BG = '#070707';
const SIGN_INK = '#f2ede4';

function drawQr(g, w, h) {
  g.fillStyle = SIGN_BG;
  g.fillRect(0, 0, w, h);
  // a chunky 13x13 code so every module survives the character grid
  const rows = [
    '11111 0 11111',
    '10001 1 10001',
    '10101 0 10101',
    '10001 1 10001',
    '11111 0 11111',
    '0000010100000',
    '1011101101101',
    '0000001011010',
    '11111 1 01101',
    '10001 0 11010',
    '10101 1 00111',
    '10001 0 11011',
    '11111 1 10101',
  ].map((r) => r.replace(/ /g, '0'));
  const n = 13, size = w * 0.76, m = size / n;
  const ox = (w - size) / 2, oy = h * 0.44 - size / 2;
  const finder = (x, y) => (x < 5 && y < 5) || (x > 7 && y < 5) || (x < 5 && y > 7);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (rows[y][x] !== '1') continue;
      g.fillStyle = finder(x, y) ? '#fbab02' : SIGN_INK;
      g.fillRect(ox + x * m, oy + y * m, m + 0.5, m + 0.5);
    }
  }
  // a plate and cloche under the code
  const cy = oy + size + 190;
  g.fillStyle = SIGN_INK;
  g.beginPath();
  g.ellipse(w / 2, cy, 170, 18, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(w / 2, cy - 14, 122, Math.PI, 0);
  g.closePath();
  g.fillStyle = '#b9b2a7';
  g.fill();
  g.fillStyle = SIGN_INK;
  g.fillRect(w / 2 - 14, cy - 162, 28, 28);
}

function drawTree(g, w, h) {
  g.fillStyle = SIGN_BG;
  g.fillRect(0, 0, w, h);
  const cx = w / 2, base = h * 0.8;
  // trunk and branches
  g.strokeStyle = '#9a7a5c';
  g.lineCap = 'round';
  g.lineWidth = 44;
  g.beginPath(); g.moveTo(cx, base); g.lineTo(cx, base - 380); g.stroke();
  g.lineWidth = 20;
  for (const [dx, dy, ex, ey] of [[0, -230, -150, -360], [0, -290, 160, -410], [0, -360, -90, -500]]) {
    g.beginPath(); g.moveTo(cx + dx, base + dy); g.lineTo(cx + ex, base + ey); g.stroke();
  }
  // canopy
  const blobs = [[0, -620, 175], [-150, -520, 135], [150, -540, 140], [-60, -470, 120], [80, -440, 115], [0, -760, 115]];
  for (const [dx, dy, r] of blobs) {
    const grd = g.createRadialGradient(cx + dx - r * 0.3, base + dy - r * 0.4, r * 0.1, cx + dx, base + dy, r);
    grd.addColorStop(0, SIGN_INK);
    grd.addColorStop(1, '#8d877d');
    g.fillStyle = grd;
    g.beginPath(); g.arc(cx + dx, base + dy, r, 0, Math.PI * 2); g.fill();
  }
  // the chaputs: rags tied under the canopy
  const rags = [[-150, -360, '#f2361c'], [160, -405, '#fbab02'], [-90, -330, '#fa8a02'], [95, -330, '#f2361c'], [-200, -420, '#fbab02']];
  for (const [dx, dy, col] of rags) {
    g.fillStyle = col;
    g.save();
    g.translate(cx + dx, base + dy);
    g.rotate(dx > 0 ? 0.12 : -0.12);
    g.fillRect(-11, 0, 22, 84);
    g.restore();
  }
  g.fillStyle = '#6d675f';
  g.fillRect(cx - 190, base, 380, 14);
}

function drawPaw(g, w, h) {
  g.fillStyle = SIGN_BG;
  g.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.54;
  g.fillStyle = SIGN_INK;
  g.beginPath(); g.ellipse(cx, cy + 40, 150, 125, 0, 0, Math.PI * 2); g.fill();
  for (const [dx, dy, rx, ry, rot] of [[-165, -120, 52, 70, -0.35], [-62, -205, 56, 76, -0.1], [62, -205, 56, 76, 0.1], [165, -120, 52, 70, 0.35]]) {
    g.beginPath(); g.ellipse(cx + dx, cy + dy, rx, ry, rot, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#5f5a53';
  for (const [x, y, r] of [[80, 220, 26], [440, 300, 18], [110, 960, 22], [450, 1010, 30], [300, 1120, 12], [60, 640, 12]]) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

/* ── module helpers ───────────────────────────────────── */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(g, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const iw = img.width * s, ih = img.height * s;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function buildAtlas(cw, ch) {
  const n = 95;
  const c = document.createElement('canvas');
  c.width = n * cw; c.height = ch;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(ch * 0.74)}px "JetBrains Mono", ui-monospace, monospace`;
  for (let i = 1; i < n; i++) g.fillText(String.fromCharCode(32 + i), i * cw + cw / 2, ch * 0.55);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function buildCodeTexture() {
  const N = 256;
  const data = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) {
    let row = '';
    let k = (y * 7) % CODE.length;
    while (row.length < N) { row += CODE[k] + '   '; k = (k + 53) % CODE.length; }
    for (let x = 0; x < N; x++) {
      const v = row.charCodeAt(x) - 32;
      data[y * N + x] = v > 0 && v < 95 ? v : 0;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
