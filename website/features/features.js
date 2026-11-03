// Features scroll section for thebalancetoolkit.com.
// The 3D board is the input; scrolling moves through the toolkit's features and the device panel
// above the board changes with them. Needs the import map for "three" and <section id="features">.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const root = document.getElementById("features");
const MODEL_URL = root.dataset.model || "features/wii_balance_board.glb";
const NARROW = 860;          // the site's mobile breakpoint
const FOV = 30;
const TWIN_X = 0.62;         // where the second board stands during pairing (metres)

// Where the board sits on screen, as fractions of the stage: [centre x, centre y, max width, max height].
const DESK = [0.67, 0.81, 0.30, 0.27];
const MOB = [0.5, 0.6, 0.62, 0.15];

// One stop per step. phi/theta: camera elevation and orbit angle. twin: show the second board.
// cop: centre-of-pressure dot and sensor rings. link: data line to the device. sync: pairing pulse.
const STOPS = [
  { phi: 1.0,  theta: 0.35,  desk: [0.67, 0.5, 0.58, 0.5], mob: [0.5, 0.38, 0.92, 0.3], twin: 1, cop: 0.8, link: 0, sync: 1, flamingo: 1 },
  { phi: 0.95, theta: -0.25, desk: DESK, mob: MOB, twin: 0, cop: 1, link: 1, sync: 0, flamingo: 0 },
  { phi: 0.88, theta: 0.3,   desk: DESK, mob: MOB, twin: 0, cop: 1, link: 1, sync: 0, flamingo: 0 },
  { phi: 1.05, theta: -0.45, desk: DESK, mob: MOB, twin: 0, cop: 1, link: 1, sync: 0, flamingo: 0 },
  { phi: 0.85, theta: 0.15,  desk: DESK, mob: MOB, twin: 0, cop: 1, link: 1, sync: 0, flamingo: 0 },
  { phi: 1.1,  theta: 0.6,   desk: DESK, mob: MOB, twin: 0, cop: 1, link: 1, sync: 0, flamingo: 0 },
  { phi: 0.9,  theta: 0.25,  desk: [0.67, 1.5, 0.30, 0.27], mob: [0.5, 1.45, 0.62, 0.15], twin: 0, cop: 0, link: 0, sync: 0, flamingo: 0 },
];
// Before the story pins: the board seen from straight above, like the cover's plan view, with the
// cover's flamingo on its top edge. It tilts into the first stop as the story scrolls into place.
const PRE = { phi: 0.03, theta: 0, desk: [0.62, 0.5, 0.42, 0.55], mob: [0.5, 0.4, 0.85, 0.32], twin: 0, cop: 1, link: 0, sync: 0, flamingo: 1 };

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const stage = root.querySelector(".tbf-stage");
const canvas = root.querySelector(".tbf-canvas");
const story = root.querySelector(".tbf-story");
const statusEl = root.querySelector(".tbf-status");
const steps = [...root.querySelectorAll(".tbf-step")];
const screens = [...root.querySelectorAll(".tbf-screen")];
const rail = root.querySelector(".tbf-rail");
const link = root.querySelector(".tbf-link");
const linkPath = link.querySelector("path");
const [linkA, linkB] = link.querySelectorAll("circle");

const css = getComputedStyle(root);
const token = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
const C = {
  ink: token("--ink", "#121212"), red: token("--red", "#e50012"), muted: token("--muted", "#5b5a56"),
  rule: token("--rule", "#d9d6cf"), paper: token("--paper", "#ffffff"),
};

// ---- the simulated session: a 20 s single leg stance cycle (stand, left leg up, stand,
// right leg up). Same function as sim/make_session.py, which wrote the session the app
// footage replays, so the board, the Unity panel and the recordings show the same data.
// CoP is normalised -1..1 like the toolkit: x = (TR+BR-TL-BL)/total, y = (TR+TL-BR-BL)/total.
const PERIOD = 20, RAMP = 0.9, WEIGHT = 68;
const SWAY_X = [[0.035, 3, 0.3], [0.022, 7, 1.7], [0.012, 17, 2.9], [0.006, 41, 0.8]];
const SWAY_Y = [[0.030, 2, 1.1], [0.020, 5, 2.3], [0.010, 11, 0.4], [0.006, 37, 2.0]];
const smooth = (u) => { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); };
const phaseWindow = (t, start, end) => {
  const bump = (u) => smooth((u - start) / RAMP) - smooth((u - end) / RAMP);
  return bump(t) + bump(t + PERIOD);
};
const sway = (terms, t) => terms.reduce((s, [a, n, p]) => s + a * Math.sin(2 * Math.PI * n * t / PERIOD + p), 0);
function copAt(time) {
  const t = ((time % PERIOD) + PERIOD) % PERIOD;
  const leftUp = phaseWindow(t, 4, 10), rightUp = phaseWindow(t, 14, 20);
  const amp = 1 + 2.2 * (leftUp + rightUp);
  return {
    x: 0.42 * (leftUp - rightUp) + amp * sway(SWAY_X, t),
    y: 0.06 * leftUp + 0.04 * rightUp + amp * sway(SWAY_Y, t),
  };
}
const loadsAt = ({ x, y }) => {
  const w = WEIGHT / 4;
  return { tr: w * (1 + x) * (1 + y), br: w * (1 + x) * (1 - y), tl: w * (1 - x) * (1 + y), bl: w * (1 - x) * (1 - y) };
};

// ---- progress rail
const dots = steps.map((s) => {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", s.dataset.title);
  b.title = s.dataset.title;
  b.addEventListener("click", () => s.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" }));
  rail.appendChild(b);
  return b;
});

// ---- renderer (transparent background)
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  statusEl.textContent = "This browser can't show 3D content (WebGL is off).";
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.72;

const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 30);

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(0.5, 1.7, 0.3);
key.target.position.set(0.3, 0, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -0.8, right: 0.8, top: 0.8, bottom: -0.8, near: 0.5, far: 3.5 });
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.002;
scene.add(key, key.target);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.14 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const blobTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
function contactShadow() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.44),
    new THREE.MeshBasicMaterial({ map: blobTexture, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0004;
  scene.add(m);
  return m;
}
const blobA = contactShadow();
const blobB = contactShadow();

const red = new THREE.Color(C.red);
const flatMat = (opacity = 0) => new THREE.MeshBasicMaterial({ color: red, transparent: true, opacity, depthWrite: false });
function flat(geometry, material) {
  const m = new THREE.Mesh(geometry, material);
  m.rotation.x = -Math.PI / 2;
  scene.add(m);
  return m;
}

// pairing ripples, two per board
const ripples = [0, 1].flatMap((b) => [0, 0.5].map((phase) => ({
  b, phase, mesh: flat(new THREE.RingGeometry(0.29, 0.296, 96), flatMat()),
})));

// centre-of-pressure dot and trail on the top surface
const TOP_Y = 0.0546;
const copDot = flat(new THREE.CircleGeometry(0.0075, 32), flatMat());
copDot.renderOrder = 2;
const TRAIL = 150;
const trailPos = new Float32Array(TRAIL * 3);
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: red, transparent: true, opacity: 0, depthWrite: false }));
trail.renderOrder = 1;
scene.add(trail);
const copToWorld = (c, out) => out.set(c.x * 0.2, TOP_Y, -c.y * 0.12);   // +y is the top edge in plan view, as on the cover and in the app

let boardA = null, boardB = null, ledMat = null;

const flamingo = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, opacity: 0, depthWrite: false }));
flamingo.center.set(0.5, 0);                     // stands on its foot, and leans around it
flamingo.scale.set(0.12, 0.18, 1);
flamingo.renderOrder = 3;
scene.add(flamingo);
(() => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 400; c.height = 600;
    c.getContext("2d").drawImage(img, 0, 0, 400, 600);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    flamingo.material.map = tex;
    flamingo.material.needsUpdate = true;
  };
  img.src = root.dataset.flamingo || "assets/art/logo-flamingo-red.svg";
})();
const sensors = [];

const loader = new GLTFLoader();
async function loadBoard() {
  try {
    return await loader.loadAsync(MODEL_URL);
  } catch (err) {
    // Hosts that refuse .glb files (like the Claude artifact preview) get a base64 copy instead.
    const res = await fetch(MODEL_URL + ".b64.txt");
    if (!res.ok) throw err;
    const bin = Uint8Array.from(atob((await res.text()).trim()), (c) => c.charCodeAt(0));
    return await loader.parseAsync(bin.buffer, "");
  }
}

loadBoard().then((gltf) => {
  boardA = gltf.scene;
  boardA.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const led = boardA.getObjectByName("PowerLED");
  if (led) { ledMat = led.material.clone(); led.material = ledMat; }
  boardB = boardA.clone();               // shares materials, so its light blinks too
  scene.add(boardA, boardB);

  for (const name of ["Foot_FL", "Foot_FR", "Foot_BL", "Foot_BR"]) {
    const foot = boardA.getObjectByName(name);
    if (!foot) continue;
    const c = new THREE.Box3().setFromObject(foot).getCenter(new THREE.Vector3());
    const ring = flat(new THREE.RingGeometry(0.025, 0.029, 64), flatMat());
    ring.position.set(c.x, 0.0008, c.z);
    sensors.push({ ring, sx: Math.sign(c.x), sy: c.z > 0 ? -1 : 1 });
  }
  statusEl.classList.add("is-done");
}).catch(() => {
  statusEl.textContent = "The 3D board couldn't load.";
});

// ---- interpolation between stops
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
let narrow = false;

function lerpPose(a, b, t) {
  const la = narrow ? a.mob : a.desk, lb = narrow ? b.mob : b.desk;
  const p = { layout: la.map((v, k) => lerp(v, lb[k], t)) };
  for (const k of ["phi", "theta", "twin", "cop", "link", "sync", "flamingo"]) p[k] = lerp(a[k], b[k], t);
  return p;
}

function poseAt(f) {
  const i = Math.min(Math.floor(f), STOPS.length - 2);
  return lerpPose(STOPS[i], STOPS[i + 1], ease(clamp01((f - i - 0.12) / 0.76)));   // hold briefly at each stop
}

function scrollIndex() {
  const r = story.getBoundingClientRect();
  const range = r.height - innerHeight;
  return range > 0 ? clamp01(-r.top / range) * (STOPS.length - 1) : 0;
}

// Place the camera so the board fills the layout box given for this stop.
const sph = new THREE.Spherical();
const target = new THREE.Vector3();
function placeCamera(p, w, h) {
  const [cx, cy, fw, fh] = p.layout;
  const tv = Math.tan(THREE.MathUtils.degToRad(FOV / 2)), th = tv * (w / h);
  const width = 0.511 + TWIN_X * p.twin, depth = 0.316;
  const cs = Math.abs(Math.cos(p.theta)), sn = Math.abs(Math.sin(p.theta));
  const across = width * cs + depth * sn;
  const deep = (depth * cs + width * sn) * Math.cos(p.phi) + 0.053 * Math.sin(p.phi);
  const r = Math.max(across / (2 * fw * th), deep / (2 * fh * tv)) * 1.08;
  target.set((TWIN_X / 2) * p.twin, 0.02, 0);
  sph.set(r, p.phi, p.theta);
  camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sph));
  camera.setViewOffset(w, h, (0.5 - cx) * w, (0.5 - cy) * h, w, h);
  camera.updateProjectionMatrix();
  camera.lookAt(target);
  camera.updateMatrixWorld();             // so project() below uses this frame's camera
}

// ---- Android: step through the three screens
const phoneShots = [...root.querySelectorAll(".tbf-phone-screen img")];
let phoneIndex = 0, phoneSince = 0;
function stepPhone(now) {
  const hold = phoneIndex === 0 ? 4200 : 2600;   // the live session stays longest
  if (now - phoneSince < hold) return;
  phoneSince = now;
  phoneShots[phoneIndex].classList.remove("is-on");
  phoneIndex = (phoneIndex + 1) % phoneShots.length;
  phoneShots[phoneIndex].classList.add("is-on");
}

// ---- active stop: swap panels, play the right video
let active = -1;
function setActive(i) {
  if (i === active) return;
  active = i;
  screens.forEach((s) => {
    const on = Number(s.dataset.stop) === i;
    s.classList.toggle("is-active", on);
    const v = s.querySelector("video");
    if (v) { if (on) v.play().catch(() => {}); else v.pause(); }
  });
  dots.forEach((d, k) => d.setAttribute("aria-current", k === i ? "true" : "false"));
  if (i === 4) phoneSince = performance.now();
}

// ---- layout
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  narrow = w <= NARROW;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
}
new ResizeObserver(resize).observe(canvas);
resize();

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "200px" }).observe(story);

// ---- settle: after the scroll comes to rest near a step, glide the rest of the way onto it.
// It waits for the last scroll event (so it never fights a swipe or trackpad momentum), moves
// slowly with an ease in and out, and stops the moment the reader scrolls, taps or presses a key.
let settleTimer = 0, glide = 0;
const stopGlide = () => { cancelAnimationFrame(glide); glide = 0; };
for (const type of ["wheel", "touchstart", "pointerdown", "keydown"]) addEventListener(type, stopGlide, { passive: true });

function glideTo(y) {
  const y0 = scrollY, dy = y - y0, t0 = performance.now();
  const duration = 900 + Math.min(400, Math.abs(dy));
  const step = (now) => {
    const u = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, y0 + dy * (0.5 - 0.5 * Math.cos(Math.PI * u)));   // ease in and out
    glide = u < 1 ? requestAnimationFrame(step) : 0;
  };
  glide = requestAnimationFrame(step);
}

function settle() {
  const r = story.getBoundingClientRect();
  if (r.top > 1 || r.bottom < innerHeight - 1) return;          // only while the story is pinned
  const g = scrollIndex(), d = g - Math.round(g);
  if (Math.abs(d) < 0.03 || Math.abs(d) > 0.3) return;          // already there, or clearly between
  const perStop = (r.height - innerHeight) / (STOPS.length - 1);
  if (reduceMotion) window.scrollTo(0, scrollY - d * perStop);
  else glideTo(scrollY - d * perStop);
}
addEventListener("scroll", () => {
  if (glide) return;                                             // our own glide, not the reader
  clearTimeout(settleTimer);
  settleTimer = setTimeout(settle, 320);
}, { passive: true });

// ---- loop
let f = scrollIndex();
let last = performance.now();
const v3 = new THREE.Vector3();
let trailReady = false;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!visible) return;
  const simVideo = screens.find((s) => Number(s.dataset.stop) === active)?.querySelector("video[data-sim]");
  const t = simVideo && simVideo.readyState >= 2 ? simVideo.currentTime : reduceMotion ? 2 : now / 1000;

  const goal = scrollIndex();
  f += (goal - f) * (reduceMotion ? 1 : 1 - Math.exp(-dt * 7));
  setActive(Math.round(goal));
  steps.forEach((s, k) => { s.firstElementChild.style.opacity = clamp01(1.2 - Math.abs(goal - k) * 1.4); });

  const w = canvas.clientWidth, h = canvas.clientHeight;
  // until the story pins, tilt from the cover's plan view into the first stop
  const storyTop = story.getBoundingClientRect().top;
  // (the board comes into view once the story's top passes mid-screen, so the tilt starts there)
  const p = storyTop > 0 ? lerpPose(PRE, STOPS[0], ease(clamp01(1 - storyTop / (0.55 * innerHeight)))) : poseAt(f);
  placeCamera(p, w, h);

  // second board slides in for pairing
  const bx = TWIN_X + (1 - p.twin) * 0.35;
  if (boardB) {
    boardB.visible = p.twin > 0.01;
    boardB.position.x = bx;
    boardB.scale.setScalar(Math.max(0.001, p.twin));
  }
  blobB.position.x = bx;
  blobB.material.opacity = p.twin;
  blobB.scale.setScalar(Math.max(0.001, p.twin));

  // pairing: ripples and a blinking light
  for (const r of ripples) {
    const u = reduceMotion ? 0.3 : (t * 0.6 + r.phase) % 1;
    r.mesh.position.set(r.b ? bx : 0, 0.0009, 0);
    r.mesh.scale.set(1 + u * 0.45, (1 + u * 0.45) * 0.66, 1);
    r.mesh.material.opacity = p.sync * (1 - u) * 0.7 * (r.b ? p.twin : 1);
  }
  if (ledMat) ledMat.emissiveIntensity = 1 + p.sync * 4 * (Math.sin(t * 9) > 0 ? 1 : 0.15);

  // centre of pressure on the board, and the load each sensor carries
  const cover = window.tbtCover;
  const c = cover && cover.on && f < 0.6 ? { x: cover.x, y: cover.y } : copAt(t);
  copToWorld(c, copDot.position);
  copDot.position.y += 0.0004;
  copDot.material.opacity = p.cop;
  copToWorld(c, v3);
  v3.y += 0.0003;
  if (!trailReady) {
    for (let k = 0; k < TRAIL; k++) trailPos.set([v3.x, v3.y, v3.z], k * 3);
    trailReady = true;
  }
  trailPos.copyWithin(0, 3);
  trailPos.set([v3.x, v3.y, v3.z], (TRAIL - 1) * 3);
  trailGeo.attributes.position.needsUpdate = true;
  trail.material.opacity = 0.45 * p.cop;
  for (const s of sensors) {
    const load = (1 + s.sx * c.x) * (1 + s.sy * c.y) / 4;
    s.ring.material.opacity = p.cop * Math.min(1, 0.2 + load * 1.8);
    s.ring.scale.setScalar(1 + load * 0.7);
  }

  // the flamingo leans with the centre of pressure, as on the cover
  flamingo.visible = p.flamingo > 0.01;
  flamingo.material.opacity = p.flamingo;
  flamingo.position.set(c.x * 0.05, TOP_Y, -0.128);
  flamingo.material.rotation = -c.x * 0.25;

  // data line from the board up to the device panel
  const scr = screens.find((s) => Number(s.dataset.stop) === active);
  if (scr && p.link > 0.02) {
    const sr = stage.getBoundingClientRect();
    const dev = scr.firstElementChild.getBoundingClientRect();
    v3.set(0, 0.07, 0).project(camera);
    const x1 = (v3.x + 1) / 2 * w, y1 = (1 - v3.y) / 2 * h;
    const x2 = dev.left + dev.width / 2 - sr.left, y2 = dev.bottom - sr.top + 6;
    const k = Math.max(30, (y1 - y2) * 0.5);
    linkPath.setAttribute("d", `M${x1},${y1} C${x1},${y1 - k} ${x2},${y2 + k} ${x2},${y2}`);
    linkA.setAttribute("cx", x1); linkA.setAttribute("cy", y1);
    linkB.setAttribute("cx", x2); linkB.setAttribute("cy", y2);
    link.style.opacity = p.link;
  } else {
    link.style.opacity = 0;
  }

  // panels that follow the session
  if (active === 4) stepPhone(now);

  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
