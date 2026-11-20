// Göktigin landing: a 3D scene drawn as ASCII, where the characters come from
// our own source code. Under the cursor a lens "compiles" them into the real render.
import * as THREE from 'three';
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

/* ── cards rise in as they scroll into view ─────────────── */
if (!reduced && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('js-rise');
  const rise = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); rise.unobserve(en.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.build .card, .build .prompt').forEach((el) => rise.observe(el));
}

main().catch((err) => {
  console.warn('ASCII stage disabled:', err);
  document.getElementById('stage')?.remove();
  document.documentElement.classList.add('no-stage');
});

async function main() {
  const canvas = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 required');

  // The first frame never waits on the network: fonts get a short head start, the product
  // screenshots arrive whenever they arrive (the ASCII faces don't need them).
  const fontsReady = Promise.all([
    document.fonts.load('700 20px "JetBrains Mono"'),
    document.fonts.load('500 20px "JetBrains Mono"'),
  ]).catch(() => {});
  await Promise.race([fontsReady, new Promise((r) => setTimeout(r, 350))]);

  /* ── phones run as an app shell (see styles.css): the pages scroll inside <main>,
     the document never does, so the viewport and this canvas never resize mid-gesture ── */
  const shellMQ = matchMedia('(max-width: 820px)');
  const shell = shellMQ.matches;
  // crossing the breakpoint swaps the whole page model; a reload is the honest way to do it
  shellMQ.addEventListener?.('change', () => location.reload());
  const scroller = shell ? document.querySelector('main') : null;
  const scrollPos = () => (scroller ? scroller.scrollTop : scrollY);

  /* ── sizes ─────────────────────────────────────────── */
  let W = innerWidth, H = innerHeight;
  // Pixel ratio is capped at 1.5 (glyphs stay sharp, a third less fill work than 2x),
  // and drops to 1 on its own if frames keep arriving late.
  let dprCap = 1.5;
  let dpr = Math.min(devicePixelRatio || 1, dprCap);
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
  // a phone's corners are wide arcs, not a box's rounded edges: the outline is a rounded
  // rectangle extruded to the depth, with a small bevel to soften the rim
  const BODY_R = 0.16;
  const body = new THREE.Mesh(
    deviceBody(DW, DH, DD, BODY_R, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.85, roughness: 0.3 }),
  );
  device.add(body);

  const SW = 0.92, SH = 1.97;
  // the glass follows the body's curve, inset by the bezel (in screen-canvas pixels)
  const SCREEN_R = Math.round(((BODY_R - (DW - SW) / 2) / SW) * 540);
  // every screen has two faces: the real UI (seen through the lens) and a line drawing of it
  // that the ASCII pass turns into characters
  const screens = {
    artofmenu: { ascii: canvasTexture(screenCanvas(drawBlank, true)), real: null },
    chaput: { ascii: canvasTexture(screenCanvas(drawBlank, true)), real: null },
    benek: { ascii: canvasTexture(screenCanvas(drawBlank, true)), real: null },
  };
  // Both faces come from the same screenshot: the real one for the lens and the sweep,
  // and a simplified night version of it that the ASCII pass turns into characters.
  for (const [name, file] of [['artofmenu', 'artofmenu.webp'], ['chaput', 'chaput.webp'], ['benek', 'benek.jpg']]) {
    loadImage(new URL(`./assets/screens/${file}`, import.meta.url).href)
      .then((img) => {
        const sc = screens[name];
        sc.ascii.dispose();
        sc.ascii = canvasTexture(screenCanvas((g, w, h) => drawAsciiFace(g, img, w, h), true));
        sc.real = canvasTexture(screenCanvas((g, w, h) => drawCover(g, img, w, h), true));
      })
      .catch(() => {});
  }
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
    voxFrom.push(dir);
    voxDelay.push(Math.min(p.length() / 1.2, 1) * 0.45);
    vox.setColorAt(i, new THREE.Color(hex).multiplyScalar(alpha * 1.6));
  });
  vox.instanceColor.needsUpdate = true;

  // When the emblem comes apart it breaks into a few big chunks (the core and eight wedges
  // around it) that float close by, around the device, and later fly back into place.
  const N_CHUNKS = 9;
  const center = new THREE.Vector3();
  voxBase.forEach(({ p }) => center.add(p));
  center.divideScalar(voxBase.length);
  const voxChunk = voxBase.map(({ p }) => {
    const dx = p.x - center.x, dy = p.y - center.y;
    if (Math.hypot(dx, dy) < VS * 1.6) return 0;
    return 1 + (Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 8) % 8);
  });
  const chunks = Array.from({ length: N_CHUNKS }, (_, c) => {
    const rnd = (k) => { const v = Math.sin(c * 91.7 + k * 47.3) * 43758.5453; return v - Math.floor(v); };
    return {
      mid: new THREE.Vector3(), n: 0,
      // a slow orbit on a wide ellipse around the device, some in front, some behind
      a0: (c / N_CHUNKS) * Math.PI * 2 + rnd(1) * 0.5,
      r: 1.75 + rnd(2) * 0.7, speed: (rnd(3) > 0.5 ? 1 : -1) * (0.05 + rnd(4) * 0.05),
      z: -0.8 + rnd(5) * 1.4, bob: rnd(6) * 6.28,
      axis: new THREE.Vector3(rnd(7) - 0.5, rnd(8) - 0.5, rnd(9) - 0.5).normalize(),
      spin: 0.25 + rnd(10) * 0.4, delay: rnd(11) * 0.35,
      pos: new THREE.Vector3(), rot: new THREE.Quaternion(),
    };
  });
  voxBase.forEach(({ p }, i) => { const ch = chunks[voxChunk[i]]; ch.mid.add(p); ch.n++; });
  chunks.forEach((ch) => { if (ch.n) ch.mid.divideScalar(ch.n); });

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
      uWave: { value: 0 },
    },
    vertexShader: fullscreen,
    fragmentShader: common + /* glsl */`
      uniform sampler2D tScene, tCode;
      uniform vec2 uGrid, uSpan;
      uniform float uTime, uScroll, uScramble, uWave;
      in vec2 vUv;
      out vec4 fragColor;
      // " .:-=+*#%@" as atlas indices (charCode - 32)
      const float RAMP[10] = float[10](0., 14., 26., 13., 29., 11., 10., 3., 5., 32.);
      vec3 sceneAt(vec2 uv) { return srgb(texture(tScene, uv).rgb); }

      void main() {
        vec2 cell = floor(gl_FragCoord.xy);
        vec2 cuv = (cell + 0.5) * uSpan;
        // phones: the picture sways as if seen through water
        if (uWave > 0.0) {
          cuv.x += sin(cuv.y * 19.0 + uTime * 1.25) * 0.0085 * uWave;
          cuv.y += sin(cuv.x * 13.0 + uTime * 0.85 + 1.7) * 0.005 * uWave;
        }
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
      uRev: { value: new THREE.Vector4() },  // device rect in framebuffer px: x0, y0, x1, y1
      uRevP: { value: 0 },                   // how far the "compile" sweep has run, top to bottom
    },
    vertexShader: fullscreen,
    fragmentShader: common + /* glsl */`
      uniform sampler2D tCells, tReal, tAtlas;
      uniform vec2 uCell, uMouse;
      uniform float uLens, uDpr, uRevP;
      uniform vec4 uRev;
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

        // the sweep: above the line the characters have compiled into the real device
        if (uRevP > 0.0) {
          vec2 lo = frag - uRev.xy, hi = uRev.zw - frag;
          float f = 14.0 * uDpr;
          float box = smoothstep(0.0, f, min(lo.x, hi.x)) * smoothstep(0.0, f, min(lo.y, hi.y));
          if (box > 0.0) {
            float line = mix(uRev.w + f, uRev.y - f, uRevP);
            float dl = frag.y - line;
            float done = smoothstep(-1.5 * uDpr, 1.5 * uDpr, dl);
            outc = mix(outc, max(srgb(texture(tReal, vUv).rgb), BG), done * box);
            // a hot scanline with a short trail of lit glyphs behind it
            float run = step(uRevP, 0.999);
            float beam = exp(-abs(dl) / (2.5 * uDpr)) + 0.6 * exp(-max(-dl, 0.0) / (26.0 * uDpr)) * (1.0 - done) * m;
            outc += mix(RED, YEL, 0.45 + 0.4 * sin(frag.x * 0.02)) * beam * box * run;
          }
        }

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
    const nextDpr = Math.min(devicePixelRatio || 1, dprCap);
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
      // phones: each page keeps a box under the bar for the 3D object (styles.css uses the
      // same fractions in dvh); the object rides with its page while you swipe between pages
      layout.mobile = true;
      layout.halfH = halfH;
      layout.boxTop = (document.querySelector('.bar')?.getBoundingClientRect().bottom || 60) + 4;
      const world = (px) => (px / H) * 2 * halfH;
      layout.s = Math.min((world(H * 0.44) * 0.92) / DH, (halfW * 2 * 0.62) / DW);
      layout.es = Math.min((world(H * 0.31) * 0.88) / 2, (halfW * 2 * 0.6) / 2);
      layout.esSmall = Math.min((world(H * 0.21) * 0.88) / 2, (halfW * 2 * 0.5) / 2);
      layout.esPin = Math.min((world(H * 0.44) * 0.62) / 2, (halfW * 2 * 0.62) / 2);
      layout.eScale ??= layout.es;
      layout.x = 0; layout.yaw = 0;
      layout.os = Math.min(layout.es * 0.82, (halfW * 0.94) / R2);
    }
  }
  resize();
  addEventListener('resize', resize);
  // the glyph atlas is drawn again once the real monospace has arrived
  fontsReady.then(() => {
    atlas?.dispose();
    atlas = buildAtlas(cellW, cellH);
    post.uniforms.tAtlas.value = atlas;
  });

  /* ── input ─────────────────────────────────────────── */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const lens = { x: -999, y: -999, r: 0, target: 0 };
  let lensTimer = 0;
  const LENS_R = touchFirst ? 92 : 118;

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || shell) return;
    pointer.tx = (e.clientX / W) * 2 - 1;
    pointer.ty = -((e.clientY / H) * 2 - 1);
    lens.x = e.clientX; lens.y = e.clientY;
    lens.target = LENS_R;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { lens.target = 0; });
  addEventListener('blur', () => { lens.target = 0; });

  // Touch: the lens only opens on the open stage, never while reading or tapping a control.
  // A plain tap on the device replays the compile sweep.
  const TEXTY = '.card, h1, .lede, .actions, .prompt, .hint, .bar, .foot, a, button, .tabbar, .dots, .swipe-hint, .lens-handle';
  const touch = { lens: false, tap: false, moved: false, x: 0, y: 0, t0: 0 };

  // Phones have no hover, and holding a finger down to see the lens selects the text under it.
  // So on phones the lens is an object: a tap on the stage drops it there and it stays; a drag
  // that starts on it moves it 1:1 (the page doesn't scroll, nothing gets selected); a tap on
  // it puts it away. It also goes away when the page changes.
  const handle = shell ? document.createElement('div') : null;
  const lensDrag = { on: false, ox: 0, oy: 0, sx: 0, sy: 0, moved: false };
  function placeHandle() {
    if (handle) handle.style.transform = `translate3d(${lens.x - LENS_R}px, ${lens.y - LENS_R}px, 0)`;
  }
  function openLens(x, y) {
    lens.x = x; lens.y = y; lens.target = LENS_R;
    handle?.classList.add('on');
    placeHandle();
    buzz?.();
    poke();
  }
  function closeLens() {
    lens.target = 0;
    handle?.classList.remove('on');
  }
  if (handle) {
    handle.className = 'lens-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.style.width = handle.style.height = `${LENS_R * 2}px`;
    document.body.appendChild(handle);
    handle.addEventListener('pointerdown', (e) => {
      handle.setPointerCapture(e.pointerId);
      Object.assign(lensDrag, { on: true, ox: e.clientX - lens.x, oy: e.clientY - lens.y, sx: e.clientX, sy: e.clientY, moved: false });
      handle.classList.add('grab');
    });
    handle.addEventListener('pointermove', (e) => {
      if (!lensDrag.on) return;
      if (Math.hypot(e.clientX - lensDrag.sx, e.clientY - lensDrag.sy) > 6) lensDrag.moved = true;
      // keep the grab offset, so the lens doesn't jump to centre itself under the finger
      lens.x = THREE.MathUtils.clamp(e.clientX - lensDrag.ox, 0, W);
      lens.y = THREE.MathUtils.clamp(e.clientY - lensDrag.oy, 0, H);
      placeHandle();
      poke();
    });
    const endDrag = () => {
      if (lensDrag.on && !lensDrag.moved) closeLens();
      lensDrag.on = false;
      handle.classList.remove('grab');
    };
    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', () => { lensDrag.on = false; handle.classList.remove('grab'); });
  }
  addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    touch.tap = !(e.target instanceof Element && e.target.closest(TEXTY));
    touch.lens = touch.tap && !shell;
    touch.moved = false; touch.x = t.clientX; touch.y = t.clientY; touch.t0 = performance.now();
    clearTimeout(lensTimer);
    if (touch.lens) { lens.x = t.clientX; lens.y = t.clientY; lens.target = LENS_R; }
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 10) touch.moved = true;
    if (touch.lens) { lens.x = t.clientX; lens.y = t.clientY; }
  }, { passive: true });
  addEventListener('touchend', () => {
    if (shell) {
      // a quick, still tap on the stage: the device compiles, anywhere else the lens drops in
      if (!touch.moved && touch.tap && performance.now() - touch.t0 < 400) {
        if (insideDevice(touch.x, touch.y)) { closeLens(); replayReveal(); }
        else openLens(touch.x, touch.y);
      }
      return;
    }
    clearTimeout(lensTimer);
    lensTimer = setTimeout(() => { lens.target = 0; }, 450);
    if (!touch.moved && touch.tap && insideDevice(touch.x, touch.y)) {
      lens.target = 0;
      replayReveal();
    }
  }, { passive: true });

  // Tilt on phones that hand it over freely (Android). iOS would show a permission dialog
  // mid-scroll, so there the scroll itself tilts the device instead.
  if (touchFirst && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      pointer.tx = THREE.MathUtils.clamp(e.gamma / 28, -1, 1);
      pointer.ty = THREE.MathUtils.clamp((e.beta - 50) / 28, -1, 1);
    }, { passive: true });
  }

  /* ── scenes driven by scroll ───────────────────────── */
  const state = { scene: 'hero', device: 0, emblem: 0, orbit: 0, devT: 0, embT: 1, orbT: 1 };
  let spin = null; // { t0, to, swapped }
  let sceneAt = 0;
  const PRODUCTS = new Set(['artofmenu', 'chaput', 'benek']);

  // Nobody has to find the lens to get its payoff: once a product sits still in view,
  // a scanline compiles its characters into the real screen, holds, then decompiles.
  const autoReveal = true;
  const reveal = { p: 0, target: 0, clearSince: 0, until: 0, shown: null };
  const devRect = { x0: 0, y0: 0, x1: 0, y1: 0, ok: false }; // css px, top-left origin
  const hit = { at: 0, covered: false };
  function insideDevice(x, y) {
    return devRect.ok && x > devRect.x0 && x < devRect.x1 && y > devRect.y0 && y < devRect.y1;
  }
  function replayReveal() {
    if (!PRODUCTS.has(state.scene) || !screens[current].real) return;
    reveal.target = 1; reveal.shown = state.scene;
    reveal.until = performance.now() + 4200;
    poke();
  }

  function setScene(name) {
    if (name === state.scene) return;
    const prev = state.scene;
    state.scene = name;
    sceneAt = performance.now();
    state.orbT = name === 'hero' ? 1 : 0;
    if (name === 'hero' || name === 'emblem') { state.devT = 0; state.embT = 1; return; }
    state.devT = 1; state.embT = 0;
    if (shell || prev === 'emblem' || prev === 'hero' || state.device < 0.3) { current = name; spin = null; return; }
    spin = { t0: performance.now(), to: name, swapped: false };
  }
  // Render budget: 30 fps while someone interacts, 15 fps when the page just idles,
  // 8 fps when the window is in the background but still on screen.
  let activeUntil = 0, scrollingUntil = 0;
  function poke() { activeUntil = performance.now() + 1600; }
  addEventListener('pointermove', poke, { passive: true });
  const onScroll = () => { poke(); scrollingUntil = performance.now() + 220; };
  addEventListener('scroll', onScroll, { passive: true });
  scroller?.addEventListener('scroll', onScroll, { passive: true });
  addEventListener('touchmove', poke, { passive: true });
  addEventListener('wheel', poke, { passive: true });
  let focused = document.hasFocus();
  addEventListener('focus', () => { focused = true; poke(); });
  addEventListener('blur', () => { focused = false; });
  let lateFrames = 0, timedFrames = 0;

  let activeEl = document.querySelector('[data-scene]');
  const heroEl = document.querySelector('.hero') || activeEl;
  // the logo forms above the process list and rides away with it; the FAQ keeps it there
  const processEl = document.getElementById('process') || activeEl;
  let anchored = false;
  let lastScrollY = scrollPos(), scrollLean = 0;
  if (!shell) {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { activeEl = en.target; setScene(en.target.dataset.scene); }
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('[data-scene]').forEach((el) => io.observe(el));
  }

  // Phones: five snapping pages. Each knows its stage box (fraction of the height, as in
  // styles.css) and what stands in it. The products page holds a sideways slider.
  const PAGES = shell ? [
    { el: document.querySelector('.hero'), box: 0.31, tab: -1 },
    { el: document.getElementById('products'), box: 0.44, tab: 0 },
    { el: document.getElementById('process'), box: 0.21, tab: 1 },
    { el: document.getElementById('faq'), box: 0.21, tab: 2 },
    { el: document.getElementById('contact'), box: 0.31, tab: 3 },
  ].filter((pg) => pg.el) : [];
  const slides = document.querySelector('.slides');
  const slideEls = slides ? [...slides.querySelectorAll('[data-scene]')] : [];
  const dots = [...document.querySelectorAll('.dots i')];
  const tabbar = document.querySelector('.tabbar');
  const tabs = tabbar ? [...tabbar.querySelectorAll('a')] : [];
  let page = PAGES[0] || null;
  const slide = { p: 0, idx: 0 };
  // a tick on snaps, only once the visitor has touched the page (browsers refuse it before)
  const buzz = () => { if (navigator.userActivation?.hasBeenActive) try { navigator.vibrate?.(6); } catch (e) {} };

  function slideProgress() {
    if (!slides || slideEls.length < 2) return 0;
    const step = slideEls[1].offsetLeft - slideEls[0].offsetLeft || 1;
    return THREE.MathUtils.clamp(slides.scrollLeft / step, 0, slideEls.length - 1);
  }
  function sceneFor(pg) {
    if (pg.el.classList.contains('hero')) return 'hero';
    if (pg.el.id === 'products') return slideEls[slide.idx]?.dataset.scene || 'artofmenu';
    return 'emblem';
  }
  function showTab(pg) {
    if (!tabbar) return;
    tabbar.style.setProperty('--pill-o', pg.tab < 0 ? '0' : '1');
    if (pg.tab >= 0) tabbar.style.setProperty('--tab', String(pg.tab));
    tabs.forEach((a, i) => { a.classList.toggle('on', i === pg.tab); if (i === pg.tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }
  if (shell && scroller) {
    const pio = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        const pg = PAGES.find((x) => x.el === en.target);
        if (!pg || pg === page) continue;
        page = pg; activeEl = pg.el;
        closeLens();
        showTab(pg); buzz();
        setScene(sceneFor(pg));
      }
    }, { root: scroller, threshold: 0.55 });
    PAGES.forEach((pg) => pio.observe(pg.el));
    showTab(page);

    // in-page links (tab bar, brand, hero button) scroll the page scroller, not the document
    document.addEventListener('click', (e) => {
      const a = e.target instanceof Element && e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href').slice(1);
      const target = id === 'top' ? PAGES[0]?.el : document.getElementById(id);
      if (!target || !scroller.contains(target)) return;
      e.preventDefault();
      scroller.scrollTo({ top: target.offsetTop, behavior: reduced ? 'auto' : 'smooth' });
    });

    // products: the slider drives the dots; the device follows it in the frame loop
    slides?.addEventListener('scroll', () => {
      poke();
      const idx = Math.round(slideProgress());
      if (idx !== slide.idx) {
        slide.idx = idx;
        dots.forEach((d, i) => d.classList.toggle('on', i === idx));
        buzz();
      }
    }, { passive: true });
    dots[0]?.classList.add('on');

    // FAQ as an accordion: one answer open at a time
    const qas = [...document.querySelectorAll('.faq .qa')];
    qas.forEach((qa) => {
      const dt = qa.querySelector('dt');
      if (!dt) return;
      dt.setAttribute('role', 'button');
      dt.setAttribute('tabindex', '0');
      dt.setAttribute('aria-expanded', 'false');
      const toggle = () => {
        const open = !qa.classList.contains('open');
        qas.forEach((o) => { o.classList.remove('open'); o.querySelector('dt')?.setAttribute('aria-expanded', 'false'); });
        if (open) { qa.classList.add('open'); dt.setAttribute('aria-expanded', 'true'); }
      };
      dt.addEventListener('click', toggle);
      dt.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

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
    const busy = now < activeUntil || spin || intro < 1 || lens.r > 1 || reveal.p > 0
      || Math.abs(state.device - state.devT) > 0.02 || Math.abs(state.emblem - state.embT) > 0.02;
    // on phones the hero emblem rides along with the page, so it keeps pace with the scroll
    // phones: the water never stops, so idle there is 30 fps rather than 15
    const budget = layout.mobile && now < scrollingUntil ? 15 : layout.mobile ? 32 : !focused && !busy ? 120 : busy ? 32 : 64;
    if (now - last < budget) { requestAnimationFrame(frame); return; }
    // frames that keep arriving far later than asked mean the GPU is struggling: drop to 1x
    if (busy && dprCap > 1 && (devicePixelRatio || 1) > 1) {
      timedFrames++;
      if (now - last > 55) lateFrames++;
      if (timedFrames >= 45) {
        if (lateFrames > 25) { dprCap = 1; resize(); }
        timedFrames = 0; lateFrames = 0;
      }
    }
    const dt = Math.min((now - last) / 1000, 0.13);
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

    // phones: the slider's position turns the device with the finger, and the screen
    // changes exactly when it is edge-on (half a slide)
    if (shell && page && page.el.id === 'products' && slides) {
      slide.p = slideProgress();
      const idx = Math.round(slide.p);
      const name = slideEls[idx]?.dataset.scene;
      if (name && name !== state.scene) setScene(name);
      if (name) current = name;
      const off = slide.p - idx;
      extra = reduced ? 0 : off * Math.PI;
      scramble = Math.max(scramble, Math.min(1, Math.abs(off) * 2) * 0.55);
    }

    // scrolling leans the device and the emblem, as if they had a little weight
    const sy = scrollPos();
    const vel = (sy - lastScrollY) / Math.max(dt, 1 / 120);
    lastScrollY = sy;
    scrollLean += (THREE.MathUtils.clamp(vel / 2600, -0.45, 0.45) - scrollLean) * k(5);

    if (layout.mobile && page) {
      // The page's text sits right above the tab bar; the stage is whatever is left between
      // the top bar and that text, measured live, so no phone height leaves a hole.
      // The object rides with its page; while the scene hands over it glides to the new spot.
      const top = page.el.getBoundingClientRect().top;
      const first = page.el.firstElementChild?.classList.contains('sr-only')
        ? page.el.children[1] : page.el.firstElementChild;
      const contentTop = first ? first.getBoundingClientRect().top : top + H * 0.5;
      const boxH = THREE.MathUtils.clamp(contentTop - top - layout.boxTop, H * 0.16, H * 0.58);
      const cy = top + layout.boxTop + boxH / 2;
      const ty = layout.halfH * (1 - (2 * cy) / H);
      const rate = now - sceneAt > 700 ? 40 : 7;
      layout.y = anchored ? layout.y + (ty - layout.y) * k(rate) : ty;
      const world = (boxH / H) * 2 * layout.halfH;
      const halfW = layout.halfH * camera.aspect;
      const products = page.el.id === 'products';
      const sT = Math.min((world * 0.9) / DH, (halfW * 2 * 0.62) / DW);
      const hero = page.el.classList.contains('hero');
      // the logo is drawn big: on the card pages its lower part may sink under the card,
      // on the hero (bare text, no card) it stays inside its box
      const eT = products
        ? Math.min((world * 0.62) / 2, (halfW * 2 * 0.62) / 2)
        : hero
          ? Math.min((world * 1.0) / 2, (halfW * 2 * 0.72) / 2)
          : Math.min((world * 1.32) / 2, (halfW * 2 * 0.86) / 2);
      const eyT = products || hero ? ty : layout.halfH * (1 - (2 * (top + layout.boxTop + boxH * 0.62)) / H);
      const kk = anchored ? k(rate === 40 ? 12 : 5) : 1;
      layout.s += (sT - layout.s) * kk;
      layout.eScale += (eT - layout.eScale) * kk;
      layout.ey = anchored && layout.ey != null ? layout.ey + (eyT - layout.ey) * k(rate) : eyT;
      layout.os = Math.min(layout.eScale * 0.82, (halfW * 0.94) / R2);
      anchored = true;
    }

    // phones: everything floats a little on its own, as if hanging in water
    const fl = layout.mobile && !reduced ? 1 : 0;
    const drift = {
      x: fl * (Math.sin(t * 0.31) * 0.05 + Math.sin(t * 0.73 + 1.3) * 0.02),
      y: fl * (Math.sin(t * 0.47 + 0.6) * 0.07 + Math.sin(t * 1.1) * 0.015),
      rx: fl * Math.sin(t * 0.53 + 2) * 0.09,
      ry: fl * Math.sin(t * 0.29) * 0.14,
      rz: fl * Math.sin(t * 0.39) * 0.07,
    };

    const dv = easeOut(Math.max(0, state.device) * intro);
    device.visible = dv > 0.01;
    device.scale.setScalar(layout.s * (0.6 + 0.4 * dv));
    device.position.set(
      layout.x + drift.x * layout.s,
      layout.y + Math.sin(t * 0.8) * 0.04 - (1 - dv) * 0.6 + drift.y * layout.s,
      0,
    );
    device.rotation.set(
      -pointer.y * 0.28 + Math.sin(t * 0.5) * 0.04 + scrollLean + drift.rx * 0.6,
      layout.yaw + pointer.x * 0.5 + Math.sin(t * 0.35) * 0.16 + extra + drift.ry * 0.5,
      Math.sin(t * 0.4) * 0.02 + drift.rz * 0.5,
    );
    body.material.opacity = 1;
    device.traverse((o) => { if (o.material) o.material.visible = dv > 0.01; });
    if (dv < 0.98) {
      device.children.forEach((o) => { o.material.transparent = true; o.material.opacity = dv; });
    } else {
      body.material.transparent = false;
      body.material.opacity = 1; screenMat.opacity = 1; back.material.opacity = 1;
    }

    // The emblem never really leaves: away from the hero and the ending its voxels come apart
    // and wander the screen behind the device, then fly back together into the logo.
    const ev = THREE.MathUtils.clamp(state.emblem, 0, 1);
    emblem.visible = intro > 0.01;
    if (emblem.visible) {
      const embY = layout.mobile ? layout.ey ?? layout.y : layout.y;
      // desktop has no eScale (and no drift); never let it turn the position into NaN
      const eS = layout.mobile ? layout.eScale ?? 0 : 0;
      emblem.position.set(layout.x + drift.x * eS * 1.6, embY + drift.y * eS * 1.6, 0);
      emblem.scale.setScalar(layout.mobile
        ? layout.eScale
        : layout.s * (1.25 - 0.3 * Math.max(0, Math.min(1, state.orbit))));
      emblem.rotation.set(
        -pointer.y * 0.3 + scrollLean * 0.8 + drift.rx,
        layout.yaw * 0.6 + pointer.x * 0.6 + Math.sin(t * 0.45) * 0.35 + drift.ry,
        drift.rz,
      );
      const together = ev * intro;
      // the ring's shape follows the screen: tall on phones, flatter beside the device on desktop
      const ex = layout.mobile ? 0.82 : 1.0, ey = layout.mobile ? 1.15 : 0.72;
      for (const ch of chunks) {
        ch.e = easeInOut(THREE.MathUtils.clamp((together - ch.delay) / (1 - ch.delay), 0, 1));
        const a = ch.a0 + t * ch.speed;
        ch.pos.set(
          Math.cos(a) * ch.r * ex,
          Math.sin(a) * ch.r * ey + Math.sin(t * 0.6 + ch.bob) * 0.08 + scrollLean * 0.5,
          ch.z,
        );
        ch.rot.setFromAxisAngle(ch.axis, (1 - ch.e) * (t * ch.spin + ch.bob));
      }
      EMBLEM.forEach((_, i) => {
        const { p, h } = voxBase[i];
        const ch = chunks[voxChunk[i]];
        // the voxel keeps its place inside its chunk; the chunk floats, turns, and flies home
        tmpV.copy(p).sub(ch.mid).applyQuaternion(ch.rot).add(ch.pos).lerp(p, ch.e);
        tmpV.z += Math.sin(Math.PI * ch.e) * 0.6;
        tmpV.z += Math.sin(t * 1.3 + i) * 0.015 * ch.e;
        tmpQ.copy(ch.rot);
        tmpS.set(VS * 0.93, VS * h * 0.93, VS * 0.93);
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
    cu.uScroll.value = (reduced ? 0 : t * 1.6) + sy / (cellH / dpr) * 0.35;
    cu.uScramble.value = scramble;
    cu.uWave.value = fl;
    const u = post.uniforms;
    u.uLens.value = lens.r < 1 ? 0 : lens.r * dpr;
    u.uMouse.value.set(lens.x * dpr, (H - lens.y) * dpr);

    // where the device sits on screen (for the sweep and for taps)
    devRect.ok = false;
    if (device.visible && dv > 0.97) {
      device.updateMatrixWorld();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const cx of [-DW / 2, DW / 2]) for (const cy of [-DH / 2, DH / 2]) for (const cz of [-DD / 2, DD / 2]) {
        tmpV.set(cx, cy, cz).applyMatrix4(device.matrixWorld).project(camera);
        const px = (tmpV.x * 0.5 + 0.5) * W, py = (0.5 - tmpV.y * 0.5) * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      Object.assign(devRect, { x0: x0 - 6, y0: y0 - 6, x1: x1 + 6, y1: y1 + 6, ok: true });
    }

    if (autoReveal) {
      // the device has to be fully in the clear: nothing scrolled over it, not mid-swap
      let clear = PRODUCTS.has(state.scene) && !spin && current === state.scene && devRect.ok && !!screens[current].real;
      if (clear && shell) clear = page?.el.id === 'products' && Math.abs(page.el.getBoundingClientRect().top) < 3 && Math.abs(slide.p - Math.round(slide.p)) < 0.01;
      if (clear) {
        // hit-testing is cheap but not free: look again at most every 150 ms
        if (now - hit.at > 150) {
          hit.at = now; hit.covered = false;
          const cx = (devRect.x0 + devRect.x1) / 2;
          for (const fy of [0.08, 0.5, 0.92]) {
            const el = document.elementFromPoint(cx, devRect.y0 + (devRect.y1 - devRect.y0) * fy);
            if (el && el.closest('.card, .prompt, .foot')) { hit.covered = true; break; }
          }
        }
        clear = !hit.covered;
      }
      if (!clear) {
        reveal.clearSince = 0;
        if (reveal.shown !== state.scene || spin) { reveal.target = 0; reveal.shown = null; }
      } else {
        if (!reveal.clearSince) reveal.clearSince = now;
        if (reveal.shown !== state.scene && now - reveal.clearSince > 550) replayReveal();
      }
      if (reveal.target === 1 && now > reveal.until) reveal.target = 0;
    } else {
      reveal.target = 0;
    }
    reveal.p = THREE.MathUtils.clamp(reveal.p + (reveal.target ? dt / 0.9 : -dt / 0.55), 0, 1);
    if (!devRect.ok) reveal.p = 0;
    u.uRevP.value = reveal.p > 0 ? easeInOut(reveal.p) : 0;
    u.uRev.value.set(devRect.x0 * dpr, (H - devRect.y1) * dpr, devRect.x1 * dpr, (H - devRect.y0) * dpr);

    renderer.setClearColor(0x000000, 1);
    screenMat.map = screens[current].ascii;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    if (lens.r >= 1 || reveal.p > 0) {
      screenMat.map = screens[current].real || screens[current].ascii;
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
    roundRect(g, 0, 0, w, h, SCREEN_R);
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

/* ── the ASCII face of a screen ──────────────────────────
   The real UI, simplified so it reads as characters: light, colourless surfaces
   (backgrounds, cards) go dark and dark text goes bright, while photos and accent
   colours keep their hue. Half resolution plus a soft blur drops the fine print
   and keeps the layout: bars, cards, rows of text, pictures. */
function drawBlank(g, w, h) {
  g.fillStyle = '#070707';
  g.fillRect(0, 0, w, h);
}

function drawAsciiFace(g, img, w, h) {
  const sw = Math.round(w / 3), sh = Math.round(h / 3);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.filter = 'blur(0.6px)';
  drawCover(x, img, sw, sh);
  const im = x.getImageData(0, 0, sw, sh), d = im.data;
  // how light each pixel's neighbourhood is: only light areas get flipped,
  // so a dark panel keeps its bright text instead of turning into a wall
  x.filter = 'blur(7px)';
  drawCover(x, img, sw, sh);
  const area = x.getImageData(0, 0, sw, sh).data;
  const sm = (a, b, v) => { const t = Math.min(Math.max((v - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    const A = (0.2126 * area[i] + 0.7152 * area[i + 1] + 0.0722 * area[i + 2]) / 255;
    // light, colourless surroundings flip (smart invert); colour and dark areas stay
    const flip = sm(0.4, 0.62, A) * (1 - sm(0.1, 0.35, mx - mn));
    const shift = (1 - 2 * L) * flip;
    // a touch of contrast so near-white backgrounds fall all the way to black
    const k = (v) => Math.min(Math.max(((v + shift) - 0.08) * 1.25, 0), 1) * 255;
    d[i] = k(r); d[i + 1] = k(gg); d[i + 2] = k(b);
  }
  x.putImageData(im, 0, 0);
  g.imageSmoothingQuality = 'high';
  g.drawImage(c, 0, 0, w, h);
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

function deviceBody(w, h, d, r, b) {
  const sw = w / 2 - b, sh = h / 2 - b, sr = r - b;
  const shape = new THREE.Shape();
  shape.moveTo(-sw + sr, -sh);
  shape.lineTo(sw - sr, -sh);
  shape.absarc(sw - sr, -sh + sr, sr, -Math.PI / 2, 0);
  shape.lineTo(sw, sh - sr);
  shape.absarc(sw - sr, sh - sr, sr, 0, Math.PI / 2);
  shape.lineTo(-sw + sr, sh);
  shape.absarc(-sw + sr, sh - sr, sr, Math.PI / 2, Math.PI);
  shape.lineTo(-sw, -sh + sr);
  shape.absarc(-sw + sr, -sh + sr, sr, Math.PI, Math.PI * 1.5);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 16,
  });
  geo.translate(0, 0, -(d - 2 * b) / 2);
  geo.computeVertexNormals();
  return geo;
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
