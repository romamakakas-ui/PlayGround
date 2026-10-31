import * as THREE from 'three';
import { World, LANES, ZONES } from './world.js';
import { Runner } from './character.js';
import { AudioEngine } from './audio.js';

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const damp = THREE.MathUtils.damp;
const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const els = {
  stage: $('stage'),
  hud: $('hud'),
  boot: $('boot'),
  bootError: $('boot-error'),
  start: $('start-screen'),
  over: $('over-screen'),
  pause: $('pause-screen'),
  play: $('play-btn'),
  restart: $('restart-btn'),
  restartPause: $('restart-btn-pause'),
  resume: $('resume-btn'),
  menu: $('menu-btn'),
  pauseBtn: $('pause-btn'),
  muteBtn: $('mute-btn'),
  soundTogglePause: $('sound-toggle-pause'),
  score: $('score'),
  distance: $('distance'),
  coins: $('coins'),
  lives: [...document.querySelectorAll('#lives .life')],
  combo: $('combo'),
  zoneName: $('zone-name'),
  zoneToast: $('zone-toast'),
  encore: $('encore'),
  encoreFill: $('encore-fill'),
  encoreBtn: $('encore-btn'),
  toasts: $('toasts'),
  flash: $('flash'),
  speedlines: $('speedlines'),
  bestStart: $('best-score-start'),
  finalScore: $('final-score'),
  finalDistance: $('final-distance'),
  finalCoins: $('final-coins'),
  finalBest: $('final-best'),
  newBest: $('new-best'),
  touch: $('touch'),
};

const state = {
  mode: 'boot',
  distance: 0,
  speed: 17,
  score: 0,
  coins: 0,
  lives: 3,
  combo: 1,
  streak: 0,
  comboTimer: 0,
  encoreFill: 0,
  encoreActive: false,
  encoreTimer: 0,
  encoreDuration: 6.5,
  encoreReady: false,
  invuln: 0,
  hitStop: 0,
  shake: 0,
  lane: 1,
  x: 0,
  y: 0,
  vy: 0,
  sliding: 0,
  fastFall: false,
  zoneIdx: -1,
  best: 0,
  newBest: false,
  runTime: 0,
  menuScroll: 0,
  started: false,
};

try {
  state.best = Number(localStorage.getItem('kirkorov-run-best') || 0) || 0;
} catch { state.best = 0; }

function isSoftwareRenderer() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|softpipe/i.test(String(name));
  } catch {
    return false;
  }
}

const softwareRenderer = isSoftwareRenderer();
const renderScale = softwareRenderer ? 0.62 : Math.min(window.devicePixelRatio || 1, 2);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: !softwareRenderer,
    powerPreference: 'high-performance',
    alpha: false,
    precision: softwareRenderer ? 'mediump' : 'highp',
  });
} catch (error) {
  console.error(error);
  els.bootError.hidden = false;
  document.body.dataset.state = 'error';
  throw error;
}
renderer.setPixelRatio(renderScale);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.domElement.setAttribute('aria-label', 'Filipp Kirkorov 3D Runner game view');
els.stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06030c);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 420);
camera.position.set(3.6, 2.9, 8.4);

const world = new World(scene, renderer, { lite: softwareRenderer });
world.reset();

const runner = new Runner(scene);
runner.group.position.set(0, 0, -1.2);
runner.group.rotation.y = Math.PI;
runner.setMode('idle');

// Fake contact shadow
const shadowTexture = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(128, 128, 4, 128, 128, 126);
  g.addColorStop(0, 'rgba(0,0,0,0.68)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.38)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(canvas);
  return t;
})();
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 1.05),
  new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.85 }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.012;
scene.add(shadow);

// A soft pool of light on the runway beneath the star
const stagePool = new THREE.Mesh(
  new THREE.PlaneGeometry(5.2, 5.2),
  new THREE.MeshBasicMaterial({
    map: world.glowTexture,
    color: 0xffd166,
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
stagePool.rotation.x = -Math.PI / 2;
stagePool.position.set(0, 0.014, 0.3);
scene.add(stagePool);

const audio = new AudioEngine();
audio.setMuted(audio.muted);

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const fmt = (n) => Math.floor(n).toString().padStart(6, '0');
const fmtComma = (n) => Math.floor(n).toLocaleString('en-US');

function updateMuteUI() {
  const muted = audio.muted;
  els.muteBtn.classList.toggle('is-muted', muted);
  els.muteBtn.setAttribute('aria-pressed', String(muted));
  els.muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  els.soundTogglePause.textContent = `Sound: ${muted ? 'off' : 'on'}`;
}

function toast(text, variant = '') {
  const node = document.createElement('div');
  node.className = `toast${variant ? ` toast--${variant}` : ''}`;
  node.textContent = text;
  els.toasts.appendChild(node);
  setTimeout(() => node.remove(), 1450);
}

function flash(kind) {
  els.flash.classList.remove('is-hit', 'is-gold');
  void els.flash.offsetWidth;
  els.flash.classList.add(kind === 'gold' ? 'is-gold' : 'is-hit');
}

function showZoneToast(zone) {
  els.zoneToast.querySelector('.zone-toast__name').textContent = zone.name;
  els.zoneToast.querySelector('.zone-toast__kicker').textContent = zone.tag;
  els.zoneToast.classList.remove('is-show');
  void els.zoneToast.offsetWidth;
  els.zoneToast.classList.add('is-show');
}

function updateHUD() {
  els.score.textContent = fmt(state.score);
  els.distance.innerHTML = `${Math.floor(state.distance)}<span>m</span>`;
  els.coins.textContent = String(state.coins);
  els.lives.forEach((el, i) => {
    el.classList.toggle('is-on', i < state.lives);
    el.classList.toggle('is-lost', i >= state.lives);
  });
  if (state.combo > 1) {
    els.combo.classList.add('is-live');
    els.combo.querySelector('b').textContent = `×${state.combo}`;
  } else {
    els.combo.classList.remove('is-live');
  }
  const fill = state.encoreActive
    ? Math.max(0, (state.encoreTimer / state.encoreDuration) * 100)
    : state.encoreFill;
  els.encoreFill.style.width = `${clamp(fill, 0, 100)}%`;
  const ready = !state.encoreActive && state.encoreFill >= 100 && state.mode === 'playing';
  if (ready !== state.encoreReady) {
    state.encoreReady = ready;
    els.encore.classList.toggle('is-ready', ready);
    els.encoreBtn.disabled = !ready;
    els.encoreBtn.textContent = ready ? 'READY' : (state.encoreActive ? 'ON STAGE' : 'CHARGING');
  }
  if (state.encoreActive) {
    els.encore.classList.add('is-active');
    els.encoreBtn.textContent = 'ENCORE!';
  } else {
    els.encore.classList.remove('is-active');
  }
}

function setScreen(name) {
  els.start.hidden = name !== 'start';
  els.over.hidden = name !== 'over';
  els.pause.hidden = name !== 'pause';
}

// ---------------------------------------------------------------------------
// Game flow
// ---------------------------------------------------------------------------
function resetRun() {
  state.distance = 0;
  state.speed = 17;
  state.score = 0;
  state.coins = 0;
  state.lives = 3;
  state.combo = 1;
  state.streak = 0;
  state.comboTimer = 0;
  state.encoreFill = 0;
  state.encoreActive = false;
  state.encoreTimer = 0;
  state.encoreReady = false;
  state.invuln = 0;
  state.shake = 0;
  state.lane = 1;
  state.x = 0;
  state.y = 0;
  state.vy = 0;
  state.sliding = 0;
  state.fastFall = false;
  state.zoneIdx = -1;
  state.newBest = false;
  state.runTime = 0;
  state.menuScroll = 0;

  world.reset();
  runner.group.position.set(0, 0, 0);
  runner.group.rotation.y = 0;
  runner.group.scale.setScalar(1);
  runner.cape.visible = true;
  runner.group.visible = true;
  runner.setEncore(false);
  runner.hitTimer = 0;
  runner.setMode('run');
  document.body.classList.remove('is-encore');
  els.speedlines.classList.remove('is-on');
  audio.setEncore(false);
}

function startGame() {
  audio.init();
  if (audio.muted) audio.setMuted(true);
  audio.startMusic();
  audio.click();
  resetRun();
  setScreen(null);
  state.mode = 'playing';
  document.body.dataset.state = 'playing';
  updateHUD();
  updateMuteUI();
  setTimeout(() => {
    if (state.mode === 'playing') {
      showZoneToast(ZONES[0]);
      toast('COLLECT THE GOLD MICS', 'combo');
    }
  }, 500);
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'pause';
  document.body.dataset.state = 'pause';
  setScreen('pause');
  audio.stopMusic();
  updateMuteUI();
}

function resumeGame() {
  if (state.mode !== 'pause') return;
  state.mode = 'playing';
  document.body.dataset.state = 'playing';
  setScreen(null);
  audio.init();
  audio.resume?.();
  audio.startMusic();
}

function gameOver() {
  if (state.mode === 'over') return;
  state.mode = 'over';
  document.body.dataset.state = 'over';
  state.shake = 0.7;
  audio.stopMusic();
  audio.setEncore(false);
  audio.gameOver();
  runner.setMode('idle');
  runner.setEncore(false);
  state.encoreActive = false;
  els.speedlines.classList.remove('is-on');
  document.body.classList.remove('is-encore');

  const score = Math.floor(state.score);
  state.newBest = score > state.best;
  if (state.newBest) {
    state.best = score;
    try { localStorage.setItem('kirkorov-run-best', String(state.best)); } catch { /* ignore */ }
  }
  els.finalScore.textContent = fmtComma(score);
  els.finalDistance.textContent = `${Math.floor(state.distance)} m`;
  els.finalCoins.textContent = String(state.coins);
  els.finalBest.textContent = fmtComma(state.best);
  els.newBest.hidden = !state.newBest;
  els.bestStart.textContent = fmt(state.best);
  setTimeout(() => {
    setScreen('over');
    updateHUD();
  }, 420);
}

function goToMenu() {
  state.mode = 'menu';
  document.body.dataset.state = 'menu';
  setScreen('start');
  audio.stopMusic();
  audio.setEncore(false);
  runner.setMode('idle');
  runner.setEncore(false);
  runner.group.visible = true;
  runner.group.position.set(0, 0, -1.2);
  runner.group.rotation.y = Math.PI;
  world.reset();
  state.menuScroll = 0;
  els.speedlines.classList.remove('is-on');
  document.body.classList.remove('is-encore');
  els.bestStart.textContent = fmt(state.best);
  updateHUD();
}

function activateEncore() {
  if (state.mode !== 'playing' || state.encoreActive || state.encoreFill < 100) return;
  state.encoreActive = true;
  state.encoreTimer = state.encoreDuration;
  state.encoreFill = 100;
  state.encoreReady = false;
  state.score += 250;
  runner.setEncore(true);
  audio.setEncore(true);
  audio.encoreStart();
  flash('gold');
  toast('ENCORE! DOUBLE SCORE', 'encore');
  els.speedlines.classList.add('is-on');
  document.body.classList.add('is-encore');
  updateHUD();
}

function endEncore() {
  state.encoreActive = false;
  state.encoreTimer = 0;
  state.encoreFill = 0;
  state.encoreReady = false;
  runner.setEncore(false);
  audio.setEncore(false);
  els.speedlines.classList.remove('is-on');
  document.body.classList.remove('is-encore');
  toast('THE CROWD WANTS MORE', 'encore');
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------
function move(dir) {
  if (state.mode !== 'playing') return;
  const next = clamp(state.lane + dir, 0, 2);
  if (next === state.lane) return;
  state.lane = next;
  audio.blip(dir < 0 ? 520 : 620, 0.045, 'triangle', 0.025);
}

function jump() {
  if (state.mode !== 'playing') return;
  if (state.y <= 0.001 && state.sliding <= 0) {
    state.vy = 11.4;
    state.y = 0.001;
    state.sliding = 0;
    state.fastFall = false;
    audio.jump();
  } else if (state.sliding > 0) {
    state.sliding = 0;
    state.vy = 11.0;
    state.y = Math.max(state.y, 0.02);
    audio.jump();
  }
}

function slide() {
  if (state.mode !== 'playing') return;
  if (state.y > 0.05) {
    state.fastFall = true;
    state.vy = Math.min(state.vy, -20);
    return;
  }
  if (state.sliding > 0) return;
  state.sliding = 0.62;
  audio.slide();
}

function pressAction(action) {
  if (action === 'left') move(-1);
  else if (action === 'right') move(1);
  else if (action === 'jump') jump();
  else if (action === 'slide') slide();
}

// ---------------------------------------------------------------------------
// Collisions / scoring
// ---------------------------------------------------------------------------
const TMP_GOLD = new THREE.Color(0xffd166);
const TMP_CYAN = new THREE.Color(0x59ecff);

function collectCoins() {
  const py = state.y + (state.sliding > 0 ? 0.45 : 0.9);
  for (let i = world.coins.length - 1; i >= 0; i--) {
    const c = world.coins[i];
    if (!c.active) continue;
    if (Math.abs(c.z) > 0.95) continue;
    if (Math.abs(c.x - state.x) > 0.95) continue;
    if (Math.abs((c.baseY + Math.sin(c.phase) * 0.06) - py) > 1.25) continue;

    world.collect(c, TMP_GOLD);
    state.coins++;
    state.streak++;
    state.comboTimer = 2.4;
    state.combo = clamp(1 + Math.floor(state.streak / 4), 1, 8);
    const gain = 25 * state.combo * (state.encoreActive ? 2 : 1);
    state.score += gain;
    if (!state.encoreActive) state.encoreFill = Math.min(100, state.encoreFill + 3.4);
    audio.coin(state.streak);
    if (state.combo > 1 && state.streak % 4 === 0) toast(`COMBO ×${state.combo}`, 'combo');
  }
}

function checkHits() {
  if (state.invuln > 0) return;
  const bodyHalf = 0.3;
  for (let i = 0; i < world.obstacles.length; i++) {
    const o = world.obstacles[i];
    if (!o.active || o.hit) continue;
    if (Math.abs(o.z) > o.depth / 2 + 0.6) continue;
    if (Math.abs(state.x - o.x) > o.width / 2 + bodyHalf) continue;

    let hit = true;
    if (o.type === 'barrier' && state.y > 0.82) hit = false;
    if (o.type === 'truss' && state.sliding > 0) hit = false;
    if (o.type === 'speaker' && state.y > 2.3) hit = false;

    if (!hit) continue;

    if (state.encoreActive) {
      world.smash(o);
      world.clearObstacle(o);
      state.score += 60 * (state.combo > 1 ? state.combo : 1);
      audio.blip(180, 0.14, 'sawtooth', 0.05);
      continue;
    }

    // Damage!
    state.lives--;
    state.invuln = 1.7;
    state.shake = 0.72;
    state.hitStop = 0.07;
    state.combo = 1;
    state.streak = 0;
    state.comboTimer = 0;
    state.speed = Math.max(11, state.speed * 0.78);
    state.encoreFill = Math.max(0, state.encoreFill - 14);
    runner.hit();
    audio.hit();
    flash('hit');
    world.smash(o);
    world.clearObstacle(o);
    els.lives.forEach((el, idx) => {
      el.classList.toggle('is-on', idx < state.lives);
      el.classList.toggle('is-lost', idx >= state.lives);
    });
    toast(state.lives > 0 ? `${state.lives} LIFE${state.lives === 1 ? '' : 'S'} LEFT` : 'THE SHOW IS OVER');
    if (state.lives <= 0) {
      gameOver();
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Update loop
// ---------------------------------------------------------------------------
let uiTimer = 0;
let zoneTimer = 0;
let elapsed = 0;

function updatePlayer(dt) {
  const targetX = LANES[state.lane];
  const prevX = state.x;
  state.x = damp(state.x, targetX, 13, dt);
  const lateral = (state.x - prevX) / Math.max(dt, 0.0001);
  const turnTarget = clamp(-lateral * 0.055, -1, 1);
  runner.turn = damp(runner.turn, turnTarget, 7, dt);

  if (state.y > 0 || state.vy !== 0 || state.fastFall) {
    state.vy -= 33 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      const wasFast = state.fastFall;
      state.y = 0;
      state.vy = 0;
      state.fastFall = false;
      if (wasFast) {
        state.sliding = 0.5;
        audio.slide();
      }
    }
  }

  if (state.sliding > 0) {
    state.sliding -= dt;
    if (state.sliding <= 0) state.sliding = 0;
  }

  let mode = 'run';
  if (state.y > 0.03) mode = 'jump';
  else if (state.sliding > 0) mode = 'slide';
  runner.setMode(mode);
  runner.group.position.x = state.x;
  runner.group.position.y = state.y;

  if (state.invuln > 0) {
    state.invuln -= dt;
    runner.group.visible = state.encoreActive || Math.floor(elapsed * 18) % 2 === 0;
    if (state.invuln <= 0) runner.group.visible = true;
  } else if (!runner.group.visible) {
    runner.group.visible = true;
  }

  runner.update(dt, elapsed, state.speed, state.sliding > 0);

  shadow.position.x = state.x;
  shadow.position.z = 0;
  const height = clamp(state.y / 4, 0, 0.75);
  shadow.scale.setScalar(1 - height * 0.55);
  shadow.material.opacity = 0.82 * (1 - height);
  stagePool.position.x = state.x;
  stagePool.material.opacity = state.encoreActive ? 0.3 : 0.18;
  world.warmLight.position.set(state.x, 4.2, 3.2);
}

function updatePlaying(dt) {
  state.runTime += dt;
  state.distance += state.speed * dt;
  const baseSpeed = 17 + Math.min(21, state.distance * 0.0085);
  const targetSpeed = baseSpeed * (state.encoreActive ? 1.32 : 1);
  state.speed = damp(state.speed, targetSpeed, 1.4, dt);

  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.streak = 0;
      state.combo = 1;
    }
  }

  updatePlayer(dt);
  world.update(dt, state.speed, state.distance, state.x, state.encoreActive);
  collectCoins();
  checkHits();

  const multiplier = state.encoreActive ? 2 : 1;
  state.score += dt * state.speed * 6 * multiplier;

  if (state.encoreActive) {
    state.encoreTimer -= dt;
    if (state.encoreTimer <= 0) endEncore();
  }

  const zoneIdx = Math.floor(state.distance / 560) % ZONES.length;
  if (zoneIdx !== state.zoneIdx) {
    const first = state.zoneIdx === -1;
    state.zoneIdx = zoneIdx;
    const zone = world.setZone(zoneIdx);
    els.zoneName.textContent = zone.name;
    zoneTimer = 2.8;
    if (!first) {
      showZoneToast(zone);
      toast('NEW STAGE', 'encore');
      state.score += 100;
    }
  }

  if (state.hitStop > 0) state.hitStop -= dt;

  if (uiTimer <= 0) {
    updateHUD();
    uiTimer = 0.08;
  }
}

function updateMenu(dt) {
  const mobile = window.innerWidth <= 820;
  state.menuScroll += dt * 1.7;
  world.update(dt, 1.7, state.menuScroll, 0, false, false);
  runner.cape.visible = false;
  const menuX = mobile ? 0 : 1.5;
  runner.group.position.z = damp(runner.group.position.z, -1.1, 3, dt);
  runner.group.position.x = damp(runner.group.position.x, menuX, 4, dt);
  runner.group.rotation.y = damp(runner.group.rotation.y, Math.PI, 5, dt);
  runner.group.position.y = damp(runner.group.position.y, 0, 4, dt);
  runner.group.scale.setScalar(damp(runner.group.scale.x, mobile ? 1.05 : 1.24, 4, dt));
  runner.turn = damp(runner.turn, Math.sin(elapsed * 0.5) * 0.12, 2, dt);
  runner.setMode('idle');
  runner.update(dt, elapsed, 0, false);
  shadow.position.set(menuX, 0.012, -1.1);
  shadow.scale.setScalar(mobile ? 1.05 : 1.28);
  shadow.material.opacity = 0.72;
  stagePool.position.x = menuX;
  stagePool.material.opacity = 0.18;
  world.warmLight.position.set(menuX, 4.2, 2.8);
}

function updateCamera(dt) {
  const mobile = window.innerWidth <= 820;
  let px, py, pz, lx, ly, lz;

  if (state.mode === 'menu') {
    if (mobile) {
      px = 0.2; py = 2.95; pz = 8.9;
      lx = 0; ly = 1.38; lz = -1.1;
    } else {
      px = 0.2; py = 2.8; pz = 8.6;
      lx = 0.2; ly = 1.3; lz = -1.0;
    }
  } else if (state.mode === 'over') {
    px = state.x * 0.25 + 0.5; py = 3.9; pz = 7.8;
    lx = state.x * 0.35; ly = 1.25; lz = -4;
  } else {
    const follow = state.encoreActive ? 0.34 : 0.28;
    px = state.x * follow;
    py = 3.72 + state.y * 0.08;
    pz = 7.35;
    lx = state.x * 0.42;
    ly = 1.46 + state.y * 0.18;
    lz = -5.1;
  }

  const k = state.mode === 'menu' ? 3.2 : 7.5;
  camera.position.x = damp(camera.position.x, px, k, dt);
  camera.position.y = damp(camera.position.y, py, k, dt);
  camera.position.z = damp(camera.position.z, pz, k, dt);

  const look = new THREE.Vector3(lx, ly, lz);
  if (!camera.userData.look) camera.userData.look = look.clone();
  const target = camera.userData.look;
  target.x = damp(target.x, lx, k + 1, dt);
  target.y = damp(target.y, ly, k + 1, dt);
  target.z = damp(target.z, lz, k + 1, dt);

  const targetFov = mobile ? 66 : 58;
  const fov = targetFov + (state.encoreActive ? 4 : 0);
  camera.fov = damp(camera.fov, fov, 3, dt);
  camera.updateProjectionMatrix();

  if (state.shake > 0) {
    const s = state.shake;
    camera.position.x += (Math.random() - 0.5) * s * 0.32;
    camera.position.y += (Math.random() - 0.5) * s * 0.24;
    state.shake = Math.max(0, state.shake - dt * 2.4);
  }

  camera.lookAt(target);
}

const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  elapsed += dt;

  if (state.mode === 'playing') {
    if (state.hitStop <= 0) updatePlaying(dt);
    else {
      state.hitStop -= dt;
      updatePlayer(dt);
      world.update(dt * 0.25, state.speed * 0.25, state.distance, state.x, state.encoreActive);
    }
  } else if (state.mode === 'menu') {
    updateMenu(dt);
  } else if (state.mode === 'pause') {
    // frozen stage, UI handles everything
  } else if (state.mode === 'over') {
    world.update(dt * 0.35, 0, state.distance, state.x, false, false);
    runner.setMode('idle');
    runner.update(dt, elapsed, 0, false);
    shadow.position.x = state.x;
  }

  updateCamera(dt);
  audio.update();
  if (uiTimer > 0) uiTimer -= dt;
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const KEY_ACTIONS = {
  ArrowLeft: () => move(-1),
  KeyA: () => move(-1),
  ArrowRight: () => move(1),
  KeyD: () => move(1),
  ArrowUp: jump,
  KeyW: jump,
  Space: jump,
  ArrowDown: slide,
  KeyS: slide,
  KeyE: activateEncore,
};

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (state.mode === 'playing') {
    if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      pauseGame();
      return;
    }
    if (event.code in KEY_ACTIONS) {
      event.preventDefault();
      if (!event.repeat) KEY_ACTIONS[event.code]();
      return;
    }
  } else if (state.mode === 'pause') {
    if (event.code === 'Escape' || event.code === 'KeyP' || event.code === 'Enter') {
      event.preventDefault();
      resumeGame();
    }
    return;
  } else if (state.mode === 'menu' || state.mode === 'over') {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      startGame();
    }
    return;
  }
  if (event.code === 'KeyM') {
    audio.init();
    audio.toggleMuted();
    updateMuteUI();
  }
}, { passive: false });

els.play.addEventListener('click', startGame);
els.restart.addEventListener('click', startGame);
els.restartPause.addEventListener('click', startGame);
els.resume.addEventListener('click', resumeGame);
els.menu.addEventListener('click', goToMenu);
els.pauseBtn.addEventListener('click', pauseGame);
els.encoreBtn.addEventListener('click', activateEncore);
els.muteBtn.addEventListener('click', () => {
  audio.init();
  audio.toggleMuted();
  updateMuteUI();
});
els.soundTogglePause.addEventListener('click', () => {
  audio.init();
  audio.toggleMuted();
  updateMuteUI();
});

els.touch.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    pressAction(button.dataset.action);
  });
  button.addEventListener('contextmenu', (event) => event.preventDefault());
});

// Swipe / tap gestures on the stage
let gesture = null;
window.addEventListener('pointerdown', (event) => {
  if (event.target.closest('button, a')) return;
  if (state.mode !== 'playing') return;
  gesture = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId, touch: event.pointerType !== 'mouse' };
}, { passive: true });

window.addEventListener('pointerup', (event) => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  const dt = performance.now() - gesture.t;
  const wasTouch = gesture.touch;
  gesture = null;
  if (state.mode !== 'playing') return;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < 24 && dt < 280 && wasTouch) {
    jump();
    return;
  }
  if (Math.max(ax, ay) < 30) return;
  if (ax > ay) move(dx > 0 ? 1 : -1);
  else if (dy < 0) jump();
  else slide();
}, { passive: true });

window.addEventListener('pointercancel', () => { gesture = null; });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.mode === 'playing') pauseGame();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
updateMuteUI();
updateHUD();
els.bestStart.textContent = fmt(state.best);

async function boot() {
  // Let the loading screen paint before shader compilation blocks the thread.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  updateCamera(1);
  try {
    renderer.compile(scene, camera);
  } catch (error) {
    console.warn('Shader precompile skipped', error);
  }
  renderer.render(scene, camera);
  state.mode = 'menu';
  document.body.dataset.state = 'menu';
  setScreen('start');
  els.boot.classList.add('is-done');
  setTimeout(() => { els.boot.style.display = 'none'; }, 760);
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => {
      document.body.classList.add('fonts-ready');
    });
  }
  requestAnimationFrame(frame);
}

await boot();

// Handy for automated checks / screenshots
window.__kirkorov = {
  state,
  world,
  runner,
  renderer,
  camera,
  startGame,
  pauseGame,
  resumeGame,
  activateEncore,
};
