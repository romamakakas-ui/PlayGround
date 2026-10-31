import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LANES = [-2.35, 0, 2.35];
const SPAWN_Z = -118;
const DESPAWN_Z = 12;

const ZONES = [
  {
    name: 'MOSCOW',
    tag: 'THE KREMLIN STAGE',
    fog: 0x150628,
    skyTop: 0x03010a,
    skyMid: 0x180732,
    skyHorizon: 0x4a103f,
    primary: 0xff3d9a,
    secondary: 0x59ecff,
    accent: 0xffd166,
  },
  {
    name: 'SAINT PETERSBURG',
    tag: 'WHITE NIGHTS',
    fog: 0x061225,
    skyTop: 0x01040e,
    skyMid: 0x08203b,
    skyHorizon: 0x0d4d63,
    primary: 0x2cc9ff,
    secondary: 0xa56bff,
    accent: 0xd8f6ff,
  },
  {
    name: 'SOCHI',
    tag: 'BLACK SEA ARENA',
    fog: 0x1a0714,
    skyTop: 0x08020a,
    skyMid: 0x2f0a20,
    skyHorizon: 0x75280e,
    primary: 0xff6a2b,
    secondary: 0xffd166,
    accent: 0xffb347,
  },
  {
    name: 'DUBAI',
    tag: 'GOLDEN HOUR',
    fog: 0x0b0918,
    skyTop: 0x02030c,
    skyMid: 0x111a3c,
    skyHorizon: 0x5b4b22,
    primary: 0xffd166,
    secondary: 0x59ecff,
    accent: 0xfff1c7,
  },
];

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,244,205,0.95)');
  g.addColorStop(0.42, 'rgba(255,196,90,0.45)');
  g.addColorStop(1, 'rgba(255,140,30,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeFloorTexture() {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');

  const bg = c.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, '#120b20');
  bg.addColorStop(0.2, '#21112f');
  bg.addColorStop(0.5, '#2b1739');
  bg.addColorStop(0.8, '#21112f');
  bg.addColorStop(1, '#120b20');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);

  // Brushed metal streaks
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = 12 + Math.random() * 120;
    c.strokeStyle = `rgba(${200 + Math.random() * 55 | 0}, ${190 + Math.random() * 40 | 0}, 235, ${0.012 + Math.random() * 0.04})`;
    c.lineWidth = 0.5 + Math.random();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x, y + len);
    c.stroke();
  }

  // Panel seams
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  c.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = (i / 8) * h + 8;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(w, y);
    c.stroke();
  }
  const tiles = 2;
  for (let i = 1; i < tiles; i++) {
    c.beginPath();
    c.moveTo((i / tiles) * w, 0);
    c.lineTo((i / tiles) * w, h);
    c.stroke();
  }

  const laneX = [(LANES[0] + 5.5) / 11, (LANES[1] + 5.5) / 11, (LANES[2] + 5.5) / 11];
  // Lane divider dashes
  for (const nx of [laneX[0] + 0.121, laneX[2] - 0.121]) {
    c.save();
    c.shadowColor = '#ff4fa8';
    c.shadowBlur = 16;
    c.fillStyle = 'rgba(255, 110, 190, 0.52)';
    for (let y = 0; y < h; y += 86) {
      c.fillRect(nx * w - 2.5, y + 20, 5, 44);
    }
    c.restore();
  }

  // Gold runway edges
  for (const x of [6, w - 6]) {
    c.save();
    c.shadowColor = '#ffd166';
    c.shadowBlur = 22;
    c.fillStyle = 'rgba(255, 211, 110, 0.9)';
    c.fillRect(x - 3, 0, 6, h);
    c.fillStyle = 'rgba(255, 250, 216, 0.85)';
    c.fillRect(x - 1, 0, 2, h);
    c.restore();
  }

  // Spotlight smears / reflections
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * w;
    const rr = 40 + Math.random() * 70;
    const rg = c.createRadialGradient(x, Math.random() * h, 0, x, Math.random() * h, rr);
    rg.addColorStop(0, i % 2 ? 'rgba(255, 209, 102, 0.09)' : 'rgba(255, 61, 154, 0.11)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = rg;
    c.fillRect(0, 0, w, h);
  }

  // Little stage-light studs on the shoulder
  for (const nx of [0.026, 0.974]) {
    for (let y = 18; y < h; y += 64) {
      c.save();
      c.shadowColor = '#ffd166';
      c.shadowBlur = 10;
      c.fillStyle = 'rgba(255, 230, 170, 0.85)';
      c.beginPath();
      c.arc(nx * w, y, 2.4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 28);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeCityTexture() {
  const w = 2048;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, w, h);

  const layers = [
    { color: '#0e0820', count: 34, minH: 80, maxH: 260, alpha: 1 },
    { color: '#1a0c30', count: 28, minH: 40, maxH: 190, alpha: 0.94 },
  ];
  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    let x = -20;
    while (x < w) {
      const bw = 24 + Math.random() * 90;
      const bh = layer.minH + Math.random() * (layer.maxH - layer.minH);
      c.fillStyle = layer.color;
      c.globalAlpha = layer.alpha;
      c.fillRect(x, h - bh, bw, bh);
      // windows
      c.globalAlpha = 1;
      const cols = Math.max(1, Math.floor(bw / 12));
      const rows = Math.max(1, Math.floor(bh / 14));
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (Math.random() > 0.62) {
            const warm = Math.random() > 0.35;
            c.fillStyle = warm
              ? `rgba(255, ${180 + Math.random() * 60 | 0}, 100, ${0.18 + Math.random() * 0.55})`
              : `rgba(90, 220, 255, ${0.12 + Math.random() * 0.4})`;
            c.fillRect(x + 4 + cx * 12, h - bh + 6 + cy * 14, 3, 4);
          }
        }
      }
      x += bw + 6 + Math.random() * 22;
    }
  }
  // Neon skyline crowns
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * w;
    c.save();
    c.shadowColor = Math.random() > 0.5 ? '#ff3d9a' : '#59ecff';
    c.shadowBlur = 14;
    c.fillStyle = Math.random() > 0.5 ? 'rgba(255,61,154,0.7)' : 'rgba(89,236,255,0.6)';
    c.fillRect(x, h - 30 - Math.random() * 180, 2 + Math.random() * 26, 2);
    c.restore();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSignTexture() {  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 1024, 256);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.font = '900 112px Arial Black, Arial, sans-serif';
  c.shadowColor = '#ffcf5c';
  c.shadowBlur = 28;
  const g = c.createLinearGradient(0, 40, 0, 210);
  g.addColorStop(0, '#fff8de');
  g.addColorStop(0.5, '#ffd166');
  g.addColorStop(1, '#b87515');
  c.fillStyle = g;
  c.fillText('KIRKOROV', 512, 118);
  c.font = '400 36px Arial, sans-serif';
  c.fillStyle = 'rgba(255, 245, 215, 0.75)';
  c.shadowBlur = 12;
  c.fillText('W O R L D   T O U R', 512, 210);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class Particles {
  constructor(scene, max = 260) {
    this.max = max;
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.velocities = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.cursor = 0;

    for (let i = 0; i < max; i++) this.positions[i * 3 + 1] = -999;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const texture = makeGlowTexture();
    this.material = new THREE.PointsMaterial({
      size: 0.28,
      map: texture,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      opacity: 0.95,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  burst(x, y, z, count = 18, color = new THREE.Color(0xffd166), spread = 3.2) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * spread * 0.8;
      const radius = Math.random() * spread;
      this.positions[i * 3] = x + Math.cos(a) * 0.1;
      this.positions[i * 3 + 1] = y + Math.random() * 0.3;
      this.positions[i * 3 + 2] = z + Math.sin(a) * 0.1;
      this.velocities[i * 3] = Math.cos(a) * radius;
      this.velocities[i * 3 + 1] = up + 1.2;
      this.velocities[i * 3 + 2] = Math.sin(a) * radius * 0.8;
      const tint = color.clone().offsetHSL((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.15);
      this.colors[i * 3] = tint.r;
      this.colors[i * 3 + 1] = tint.g;
      this.colors[i * 3 + 2] = tint.b;
      this.life[i] = 0.55 + Math.random() * 0.65;
      this.maxLife[i] = this.life[i];
    }
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -999;
        continue;
      }
      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
      this.velocities[i * 3 + 1] -= 5.4 * dt;
      this.velocities[i * 3] *= 1 - 1.6 * dt;
      this.velocities[i * 3 + 2] *= 1 - 1.6 * dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const fade = k * k;
      this.colors[i * 3] *= 1 - (1 - fade) * dt * 2.4;
      this.colors[i * 3 + 1] *= 1 - (1 - fade) * dt * 2.4;
      this.colors[i * 3 + 2] *= 1 - (1 - fade) * dt * 2.4;
    }
    if (dirty) {
      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.attributes.color.needsUpdate = true;
    }
  }

  clear() {
    for (let i = 0; i < this.max; i++) {
      this.life[i] = 0;
      this.positions[i * 3 + 1] = -999;
      this.colors[i * 3] = this.colors[i * 3 + 1] = this.colors[i * 3 + 2] = 0;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }
}

/* Bake every static mesh in a prop into one mesh per material. This keeps the
   stage rich while cutting the draw-call count dramatically — important for
   software renderers and phones. Sprites/points are left alone. */
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const meshes = [];
  group.traverse((node) => {
    if (node.isMesh && !node.isInstancedMesh) meshes.push(node);
  });
  if (meshes.length < 2) return group;

  const byMaterial = new Map();
  for (const mesh of meshes) {
    const material = mesh.material;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const name of Object.keys(source.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') source.deleteAttribute(name);
    }
    source.applyMatrix4(mesh.matrixWorld);
    const list = byMaterial.get(material) || [];
    list.push(source);
    byMaterial.set(material, list);
  }

  for (const mesh of meshes) mesh.parent?.remove(mesh);

  for (const [material, geometries] of byMaterial) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    group.add(mesh);
  }
  return group;
}

export class World {
  constructor(scene, renderer, options = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.lite = Boolean(options.lite);
    this.zones = ZONES;
    this.zoneIndex = 0;
    this.zoneBlend = ZONES[0];
    this.obstacles = [];
    this.coins = [];
    this.obstaclePools = { speaker: [], barrier: [], truss: [] };
    this.coinPool = [];
    this.nextSpawnDistance = 26;
    this.totalSpawned = 0;
    this.time = 0;

    this.colors = {
      primary: new THREE.Color(ZONES[0].primary),
      secondary: new THREE.Color(ZONES[0].secondary),
      accent: new THREE.Color(ZONES[0].accent),
      fog: new THREE.Color(ZONES[0].fog),
    };
    this.targetColors = {
      primary: this.colors.primary.clone(),
      secondary: this.colors.secondary.clone(),
      accent: this.colors.accent.clone(),
      fog: this.colors.fog.clone(),
    };

    this.glowTexture = makeGlowTexture();
    this.buildEnvironment();
    this.buildFloor();
    this.buildSky();
    this.buildCity();
    this.buildArches();
    this.buildCrowd();
    this.buildParticles();
    this.buildSharedAssets();
    this.buildCoins();
  }

  buildEnvironment() {
    this.scene.fog = new THREE.FogExp2(0x150628, 0.0135);
    this.hemi = new THREE.HemisphereLight(0xbfc8ff, 0x2a0d35, 1.05);
    this.scene.add(this.hemi);

    const ambient = new THREE.AmbientLight(0x9a7cc4, 0.55);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe6c4, 3.1);
    key.position.set(-6, 14, 8);
    this.scene.add(key);

    if (!this.lite) {
      const rimPink = new THREE.PointLight(0xff3d9a, 28, 32, 2);
      rimPink.position.set(-8, 8, -18);
      this.scene.add(rimPink);
      this.rimPink = rimPink;

      const rimCyan = new THREE.PointLight(0x59ecff, 26, 30, 2);
      rimCyan.position.set(8, 7, -28);
      this.scene.add(rimCyan);
      this.rimCyan = rimCyan;
    }

    const warm = new THREE.PointLight(0xffc857, 65, 27, 2);
    warm.position.set(0, 5, 3);
    this.scene.add(warm);
    this.warmLight = warm;

    if (this.lite) return;

    // Procedural environment map for metal / sequins
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const c = canvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#06030d');
    g.addColorStop(0.45, '#1a072f');
    g.addColorStop(0.57, '#4d1247');
    g.addColorStop(0.68, '#15051f');
    g.addColorStop(1, '#05020a');
    c.fillStyle = g;
    c.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 1024;
      const y = 120 + Math.random() * 260;
      const rr = 20 + Math.random() * 80;
      const rg = c.createRadialGradient(x, y, 0, x, y, rr);
      const col = Math.random() > 0.5 ? '255,61,154' : '89,236,255';
      rg.addColorStop(0, `rgba(${col},0.75)`);
      rg.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = rg;
      c.fillRect(0, 0, 1024, 512);
    }
    const envTex = new THREE.CanvasTexture(canvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromEquirectangular(envTex);
    this.scene.environment = this.envRT.texture;
    envTex.dispose();
    pmrem.dispose();
  }

  buildFloor() {
    this.floorTexture = makeFloorTexture();
    const geo = new THREE.PlaneGeometry(11, 260, 1, 1);
    const mat = new THREE.MeshLambertMaterial({
      map: this.floorTexture,
      emissiveMap: this.floorTexture,
      emissive: 0x8d5cff,
      emissiveIntensity: 0.3,
      color: 0xe4deff,
    });
    this.floor = new THREE.Mesh(geo, mat);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.set(0, 0, -114);
    this.scene.add(this.floor);

    // Neon side rails
    const railMatA = new THREE.MeshStandardMaterial({ color: 0x2a0a1c, emissive: 0xff3d9a, emissiveIntensity: 2.2, metalness: 0.5, roughness: 0.3 });
    const railMatB = new THREE.MeshStandardMaterial({ color: 0x062028, emissive: 0x59ecff, emissiveIntensity: 1.7, metalness: 0.5, roughness: 0.3 });
    this.railMatA = railMatA;
    this.railMatB = railMatB;
    const railGeo = new THREE.BoxGeometry(0.07, 0.07, 260);
    for (const [x, m] of [[-5.55, railMatA], [5.55, railMatA], [-5.24, railMatB], [5.24, railMatB]]) {
      const rail = new THREE.Mesh(railGeo, m);
      rail.position.set(x, 0.045, -114);
      this.scene.add(rail);
    }

    // Dark side aprons
    const apronMat = new THREE.MeshStandardMaterial({ color: 0x08040e, metalness: 0.6, roughness: 0.6 });
    for (const side of [-1, 1]) {
      const apron = new THREE.Mesh(new THREE.PlaneGeometry(30, 260), apronMat);
      apron.rotation.x = -Math.PI / 2;
      apron.position.set(side * 20.5, -0.01, -114);
      this.scene.add(apron);
    }

    // Fake reflection glow under the runway edge
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.edgeGlowMat = glowMat;
    for (const side of [-1, 1]) {
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 260), glowMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(side * 6.4, 0.005, -114);
      this.scene.add(glow);
    }
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(300, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(ZONES[0].skyTop) },
        uMid: { value: new THREE.Color(ZONES[0].skyMid) },
        uHorizon: { value: new THREE.Color(ZONES[0].skyHorizon) },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform float uTime;
        varying vec3 vPos;
        void main() {
          vec3 dir = normalize(vPos);
          float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = mix(uHorizon, uMid, smoothstep(0.42, 0.62, h));
          col = mix(col, uTop, smoothstep(0.6, 1.0, h));
          float glow = pow(max(0.0, 1.0 - abs(h - 0.48) * 7.0), 3.0);
          col += uHorizon * glow * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.scene.add(this.sky);
    this.skyUniforms = mat.uniforms;

    // Mirror-ball moon
    const ball = new THREE.Group();
    ball.position.set(-26, 38, -118);
    const sphere = new THREE.Mesh(
      new THREE.IcosahedronGeometry(7.2, 2),
      new THREE.MeshStandardMaterial({ color: 0xd9e2ff, metalness: 1, roughness: 0.14, envMapIntensity: 2.6, emissive: 0x354a7a, emissiveIntensity: 0.55 }),
    );
    ball.add(sphere);
    this.discoBall = sphere;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0x9fb7ff,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.scale.set(38, 38, 1);
    ball.add(halo);
    this.scene.add(ball);
    this.ballGroup = ball;

    // Sparkles orbiting the ball
    const count = 80;
    const positions = new Float32Array(count * 3);
    this.ballSparkles = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 7.8 + Math.random() * 7;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI;
      this.ballSparkles[i * 3] = Math.cos(a) * Math.cos(b) * r;
      this.ballSparkles[i * 3 + 1] = Math.sin(b) * r;
      this.ballSparkles[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r;
      positions[i * 3] = this.ballSparkles[i * 3];
      positions[i * 3 + 1] = this.ballSparkles[i * 3 + 1];
      positions[i * 3 + 2] = this.ballSparkles[i * 3 + 2];
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparkMat = new THREE.PointsMaterial({
      color: 0xe7efff,
      size: 0.7,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.ballSparklePoints = new THREE.Points(sparkGeo, sparkMat);
    ball.add(this.ballSparklePoints);

    // Stage beams (kept narrow — big additive cones are murder on fill rate)
    this.beams = [];
    const beamColors = [0xff3d9a, 0x59ecff];
    for (let i = 0; i < 2; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const beamMat = new THREE.MeshBasicMaterial({
        color: beamColors[i % beamColors.length],
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.05, 23, 10, 1, true), beamMat);
      beam.position.set(side * 9.6, 12.5, -36 - i * 24);
      beam.rotation.z = side * 0.24;
      beam.rotation.x = 0.12;
      this.scene.add(beam);
      this.beams.push({ mesh: beam, side, baseX: beam.position.x, phase: Math.random() * Math.PI * 2, mat: beamMat });
    }
  }

  buildCity() {
    const tex = makeCityTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, depthWrite: false, fog: true, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(340, 64), mat);
    plane.position.set(0, 19, -168);
    this.scene.add(plane);
    this.city = plane;
    this.cityMat = mat;

    // Second, closer silhouette for parallax depth
    const mat2 = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: true, color: 0x6a4a9e, toneMapped: false });
    const plane2 = new THREE.Mesh(new THREE.PlaneGeometry(280, 48), mat2);
    plane2.position.set(-30, 11, -132);
    this.scene.add(plane2);
    this.city2 = plane2;
    this.city2Mat = mat2;
  }

  buildArches() {
    this.arches = [];
    const neonA = new THREE.MeshStandardMaterial({ color: 0x201020, emissive: 0xff3d9a, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.4 });
    const neonB = new THREE.MeshStandardMaterial({ color: 0x102020, emissive: 0x59ecff, emissiveIntensity: 1.9, metalness: 0.4, roughness: 0.4 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x191421, metalness: 0.85, roughness: 0.32 });
    this.archMats = [neonA, neonB];
    const signTex = makeSignTexture();
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.signMat = signMat;

    for (let i = 0; i < 6; i++) {
      const arch = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.28, 0.28), steel);
      beam.position.y = 7;
      arch.add(beam);
      const beamNeon = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.04, 0.04), neonA);
      beamNeon.position.set(0, 7.16, 0.15);
      arch.add(beamNeon);
      const beamNeon2 = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.025, 0.025), neonB);
      beamNeon2.position.set(0, 6.82, -0.16);
      arch.add(beamNeon2);

      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7, 0.3), steel);
        post.position.set(side * 5.05, 3.5, 0);
        arch.add(post);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 6.9, 0.03), i % 2 ? neonB : neonA);
        strip.position.set(side * 4.88, 3.5, 0.17);
        arch.add(strip);
        const strip2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 6.9, 0.03), i % 2 ? neonA : neonB);
        strip2.position.set(side * 4.88, 3.5, -0.17);
        arch.add(strip2);
        // stack of little bulbs
        for (let b = 0; b < 7; b++) {
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), i % 2 ? neonB : neonA);
          bulb.position.set(side * 4.87, 0.7 + b * 0.9, 0.2);
          arch.add(bulb);
        }
      }

      if (i % 2 === 1) {
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 0.98), signMat);
        sign.position.set(0, 6.25, 0.06);
        arch.add(sign);
      }

      mergeStatic(arch);
      arch.position.z = -6 - i * 30;
      this.scene.add(arch);
      this.arches.push(arch);
    }
  }

  buildCrowd() {
    const geo = new THREE.SphereGeometry(0.2, 6, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x120b1c, roughness: 0.9, metalness: 0.1 });
    const count = 220;
    const crowd = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    let n = 0;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        for (let i = 0; i < 22; i++) {
          if (n >= count) break;
          const z = 6 - i * 6.4 - row * 1.4;
          const x = side * (7.4 + row * 1.5 + Math.random() * 0.5);
          dummy.position.set(x, 1.2 + row * 0.62 + Math.random() * 0.2, z);
          dummy.scale.set(0.9 + Math.random() * 0.3, 1.5 + Math.random() * 0.3, 0.9);
          dummy.rotation.y = Math.random() * Math.PI;
          dummy.updateMatrix();
          crowd.setMatrixAt(n++, dummy.matrix);
        }
      }
    }
    crowd.instanceMatrix.needsUpdate = true;
    crowd.frustumCulled = false;
    this.scene.add(crowd);

    // Phone lights in the crowd
    const lights = 360;
    const positions = new Float32Array(lights * 3);
    const colors = new Float32Array(lights * 3);
    const tints = [new THREE.Color(0xffd166), new THREE.Color(0x59ecff), new THREE.Color(0xff76c1), new THREE.Color(0xffffff)];
    for (let i = 0; i < lights; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const row = Math.floor(Math.random() * 5);
      positions[i * 3] = side * (7.5 + row * 1.6 + Math.random() * 0.6);
      positions[i * 3 + 1] = 1.8 + row * 0.62 + Math.random() * 0.7;
      positions[i * 3 + 2] = 8 - Math.random() * 145;
      const tint = tints[Math.floor(Math.random() * tints.length)];
      colors[i * 3] = tint.r;
      colors[i * 3 + 1] = tint.g;
      colors[i * 3 + 2] = tint.b;
    }
    const lgeo = new THREE.BufferGeometry();
    lgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lgeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const lmat = new THREE.PointsMaterial({
      size: 0.13,
      vertexColors: true,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.crowdLights = new THREE.Points(lgeo, lmat);
    this.crowdLightsMat = lmat;
    this.scene.add(this.crowdLights);
  }

  buildParticles() {
    this.particles = new Particles(this.scene, 300);

    // Floating ambient glitter
    const count = 180;
    const positions = new Float32Array(count * 3);
    this.ambientSeeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 22;
      const y = 0.3 + Math.random() * 9;
      const z = 8 - Math.random() * 120;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      this.ambientSeeds[i * 3] = Math.random() * Math.PI * 2;
      this.ambientSeeds[i * 3 + 1] = 0.2 + Math.random() * 0.7;
      this.ambientSeeds[i * 3 + 2] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffd9a0,
      size: 0.075,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.ambient = new THREE.Points(geo, mat);
    this.ambientMat = mat;
    this.ambientGeo = geo;
    this.scene.add(this.ambient);
  }

  buildSharedAssets() {
    this.asset = {
      speakerBox: new THREE.BoxGeometry(1.5, 2.12, 1.12),
      speakerGrille: new THREE.CircleGeometry(0.38, 24),
      speakerRing: new THREE.TorusGeometry(0.4, 0.035, 6, 24),
      speakerCone: new THREE.CylinderGeometry(0.33, 0.14, 0.1, 16),
      speakerTop: new THREE.BoxGeometry(1.56, 0.16, 1.16),
      post: new THREE.CylinderGeometry(0.055, 0.075, 0.74, 8),
      postBall: new THREE.SphereGeometry(0.09, 10, 8),
      rope: null,
      trussBeam: new THREE.BoxGeometry(1.86, 0.18, 0.18),
      trussPost: new THREE.BoxGeometry(0.09, 2.6, 0.09),
      trussArm: new THREE.BoxGeometry(0.055, 0.055, 0.7),
      cameraBox: new THREE.BoxGeometry(0.4, 0.28, 0.5),
      lens: new THREE.CylinderGeometry(0.1, 0.13, 0.22, 12),
      coinHead: new THREE.SphereGeometry(0.11, 12, 10),
      coinGrill: new THREE.CylinderGeometry(0.085, 0.1, 0.06, 12),
      coinHandle: new THREE.CylinderGeometry(0.035, 0.045, 0.36, 8),
      coinRing: new THREE.CylinderGeometry(0.06, 0.06, 0.026, 10),
      coinGlow: null,
    };

    this.mats = {
      black: new THREE.MeshStandardMaterial({ color: 0x0b0810, roughness: 0.5, metalness: 0.42 }),
      darkMetal: new THREE.MeshStandardMaterial({ color: 0x1c1822, roughness: 0.34, metalness: 0.86 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffc857, roughness: 0.2, metalness: 1, emissive: 0x5a3400, emissiveIntensity: 0.4 }),
      goldBright: new THREE.MeshStandardMaterial({ color: 0xffe3a0, roughness: 0.15, metalness: 1, emissive: 0xff9d1a, emissiveIntensity: 0.55 }),
      velvet: new THREE.MeshStandardMaterial({ color: 0x7a0a2a, roughness: 0.82, metalness: 0.05 }),
      magenta: new THREE.MeshStandardMaterial({ color: 0x3a0a22, emissive: 0xff3d9a, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.3 }),
      cyan: new THREE.MeshStandardMaterial({ color: 0x062028, emissive: 0x59ecff, emissiveIntensity: 2.1, metalness: 0.4, roughness: 0.3 }),
      warning: new THREE.MeshStandardMaterial({ color: 0x2a0b02, emissive: 0xff6a2b, emissiveIntensity: 1.7, roughness: 0.5 }),
      red: new THREE.MeshStandardMaterial({ color: 0x2a0208, emissive: 0xff2233, emissiveIntensity: 2.6, roughness: 0.4 }),
      coin: new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: 1, roughness: 0.14, emissive: 0x9a5b00, emissiveIntensity: 0.65 }),
      coinHandle: new THREE.MeshStandardMaterial({ color: 0x17121e, metalness: 0.7, roughness: 0.32 }),
    };

    // rope uses CatmullRom tube shared geometry
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.72, 0.54, 0),
      new THREE.Vector3(-0.34, 0.34, 0),
      new THREE.Vector3(0, 0.32, 0),
      new THREE.Vector3(0.34, 0.34, 0),
      new THREE.Vector3(0.72, 0.54, 0),
    ]);
    this.asset.rope = new THREE.TubeGeometry(curve, 20, 0.042, 6, false);

    // Obstacle glows reuse a sprite material each
    this.asset.coinGlow = new THREE.SpriteMaterial({
      map: this.glowTexture,
      color: 0xffc857,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  makeSpeaker() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(this.asset.speakerBox, this.mats.black);
    box.position.y = 1.06;
    g.add(box);
    const top = new THREE.Mesh(this.asset.speakerTop, this.mats.darkMetal);
    top.position.y = 2.17;
    g.add(top);

    for (const y of [0.62, 1.5]) {
      const ring = new THREE.Mesh(this.asset.speakerRing, this.mats.magenta);
      ring.position.set(0, y, 0.57);
      g.add(ring);
      const cone = new THREE.Mesh(this.asset.speakerCone, this.mats.black);
      cone.rotation.x = Math.PI / 2;
      cone.position.set(0, y, 0.53);
      g.add(cone);
      const grille = new THREE.Mesh(this.asset.speakerGrille, this.mats.darkMetal);
      grille.position.set(0, y, 0.582);
      g.add(grille);
    }
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.23, 0.03), this.mats.gold);
    badge.position.set(0, 1.99, 0.58);
    g.add(badge);
    const badgeInner = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.03), this.mats.black);
    badgeInner.position.set(0, 1.99, 0.596);
    g.add(badgeInner);
    for (const side of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.03), this.mats.darkMetal);
      handle.position.set(side * 0.81, 1.1, 0.18);
      g.add(handle);
    }
    // subtle top glow
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture, color: 0xff3d9a, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(0, 2.24, 0);
    glow.scale.set(1.6, 1.6, 1);
    g.add(glow);
    g.userData.type = 'speaker';
    g.userData.width = 1.45;
    g.userData.height = 2.2;
    g.userData.depth = 1.1;
    return mergeStatic(g);
  }

  makeBarrier() {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 12), this.mats.darkMetal);
      base.position.set(side * 0.76, 0.045, 0);
      g.add(base);
      const post = new THREE.Mesh(this.asset.post, this.mats.gold);
      post.position.set(side * 0.76, 0.41, 0);
      g.add(post);
      const ball = new THREE.Mesh(this.asset.postBall, this.mats.goldBright);
      ball.position.set(side * 0.76, 0.82, 0);
      g.add(ball);
    }
    const rope = new THREE.Mesh(this.asset.rope, this.mats.velvet);
    rope.position.y = 0.02;
    g.add(rope);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.02), this.mats.gold);
    sign.position.set(0, 0.62, 0.03);
    g.add(sign);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture, color: 0xffd166, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(0, 0.55, 0);
    glow.scale.set(1.7, 1.1, 1);
    g.add(glow);
    g.userData.type = 'barrier';
    g.userData.width = 1.75;
    g.userData.height = 0.88;
    g.userData.depth = 0.5;
    return mergeStatic(g);
  }

  makeTruss() {
    const g = new THREE.Group();
    const beam = new THREE.Mesh(this.asset.trussBeam, this.mats.darkMetal);
    beam.position.y = 2.05;
    g.add(beam);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.035, 0.035), this.mats.warning);
    neon.position.set(0, 2.15, 0.1);
    g.add(neon);
    const neon2 = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.02, 0.02), this.mats.cyan);
    neon2.position.set(0, 1.95, -0.1);
    g.add(neon2);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(this.asset.trussPost, this.mats.darkMetal);
      post.position.set(side * 0.92, 1.3, 0);
      g.add(post);
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Mesh(this.asset.trussArm, this.mats.darkMetal);
        arm.position.set(side * 0.92, 0.6 + i * 0.56, 0);
        arm.rotation.x = Math.PI / 2;
        g.add(arm);
      }
    }
    // Camera rig
    const camera = new THREE.Group();
    camera.position.set(0.18, 1.8, 0.06);
    camera.rotation.x = 0.18;
    g.add(camera);
    const box = new THREE.Mesh(this.asset.cameraBox, this.mats.black);
    camera.add(box);
    const lens = new THREE.Mesh(this.asset.lens, this.mats.darkMetal);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 0.28;
    camera.add(lens);
    const rec = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), this.mats.red);
    rec.position.set(0.13, 0.12, 0.24);
    camera.add(rec);
    // Warning glow on beam
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTexture, color: 0xff6a2b, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.set(0, 2.08, 0.1);
    glow.scale.set(2.2, 0.8, 1);
    g.add(glow);
    g.userData.type = 'truss';
    g.userData.width = 1.8;
    g.userData.height = 1.6;
    g.userData.depth = 0.5;
    return mergeStatic(g);
  }

  getObstacle(type) {
    const pool = this.obstaclePools[type];
    let g = pool.find((m) => !m.visible);
    if (!g) {
      g = type === 'speaker' ? this.makeSpeaker() : type === 'barrier' ? this.makeBarrier() : this.makeTruss();
      pool.push(g);
      this.scene.add(g);
    }
    g.visible = true;
    return g;
  }

  spawnObstacle(type, lane, z, laneX = LANES[lane]) {
    const g = this.getObstacle(type);
    g.position.set(laneX, 0, z);
    g.rotation.y = 0;
    g.scale.setScalar(1);
    g.visible = true;
    const data = {
      mesh: g,
      type,
      lane,
      z,
      x: laneX,
      width: g.userData.width,
      height: g.userData.height,
      depth: g.userData.depth,
      active: true,
      hit: false,
      rotateDir: Math.random() > 0.5 ? 1 : -1,
    };
    g.userData.data = data;
    this.obstacles.push(data);
    return data;
  }

  buildCoins() {
    const CAP = 96;
    this.coinCapacity = CAP;
    const dummy = new THREE.Object3D();
    this.coinDummy = dummy;
    this.coinZero = new THREE.Matrix4().makeScale(0, 0, 0);

    const head = new THREE.SphereGeometry(0.11, 10, 8);
    head.scale(0.95, 1.1, 0.95);
    head.translate(0, 0.2, 0);
    const ring = new THREE.CylinderGeometry(0.06, 0.065, 0.026, 10);
    ring.translate(0, 0.02, 0);
    const goldGeo = mergeGeometries([head, ring], false);

    const grill = new THREE.CylinderGeometry(0.085, 0.1, 0.06, 10);
    grill.translate(0, 0.11, 0);
    const handle = new THREE.CylinderGeometry(0.035, 0.045, 0.36, 8);
    handle.translate(0, -0.09, 0);
    const blackGeo = mergeGeometries([grill, handle], false);

    this.coinGold = new THREE.InstancedMesh(goldGeo, this.mats.coin, CAP);
    this.coinBlack = new THREE.InstancedMesh(blackGeo, this.mats.coinHandle, CAP);
    this.coinGold.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinBlack.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.coinGold.frustumCulled = false;
    this.coinBlack.frustumCulled = false;
    for (let i = 0; i < CAP; i++) {
      this.coinGold.setMatrixAt(i, this.coinZero);
      this.coinBlack.setMatrixAt(i, this.coinZero);
    }
    this.coinGold.instanceMatrix.needsUpdate = true;
    this.coinBlack.instanceMatrix.needsUpdate = true;
    this.scene.add(this.coinGold, this.coinBlack);

    const glowPositions = new Float32Array(CAP * 3);
    for (let i = 0; i < CAP; i++) glowPositions[i * 3 + 1] = -999;
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
    this.coinGlowPositions = glowPositions;
    this.coinGlowPoints = new THREE.Points(glowGeo, new THREE.PointsMaterial({
      color: 0xffc857,
      size: 0.95,
      map: this.glowTexture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    this.coinGlowPoints.frustumCulled = false;
    this.scene.add(this.coinGlowPoints);
  }

  spawnCoin(x, y, z, magnet = false) {
    if (this.coins.length >= this.coinCapacity) return null;
    const data = {
      x,
      baseY: y,
      z,
      active: true,
      phase: Math.random() * Math.PI * 2,
      magnet,
      sparkle: Math.random() * 4,
    };
    this.coins.push(data);
    return data;
  }

  hideCoins() {
    if (!this.coinGold) return;
    for (let i = 0; i < this.coinCapacity; i++) {
      this.coinGold.setMatrixAt(i, this.coinZero);
      this.coinBlack.setMatrixAt(i, this.coinZero);
      this.coinGlowPositions[i * 3 + 1] = -999;
    }
    this.coinGold.instanceMatrix.needsUpdate = true;
    this.coinBlack.instanceMatrix.needsUpdate = true;
    this.coinGlowPoints.geometry.attributes.position.needsUpdate = true;
  }

  spawnCoinLine(lane, z, count = 5, arc = false, offset = 0) {
    const x = LANES[lane] + offset;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const y = arc ? 0.72 + Math.sin(t * Math.PI) * 1.05 : 0.68;
      this.spawnCoin(x + (arc ? Math.sin(t * Math.PI) * 0.35 : 0), y, z - i * 2.6);
    }
  }

  spawnRow(z, distance) {
    const d = Math.min(1, distance / 1800);
    const lanes = [0, 1, 2];
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    const roll = Math.random();
    const row = { obstacles: [], safeLanes: [] };

    if (roll < 0.12 && d < 0.4) {
      // Breather: pure coin trail
      const lane = Math.floor(Math.random() * 3);
      this.spawnCoinLine(lane, z - 1, 5, false);
      row.safeLanes = lanes;
      return row;
    }

    if (roll < 0.4 + d * 0.08) {
      // single dodge
      const lane = Math.floor(Math.random() * 3);
      const type = Math.random() < 0.22 + d * 0.25 ? 'barrier' : 'speaker';
      row.obstacles.push(this.spawnObstacle(type, lane, z));
      row.safeLanes = lanes.filter((l) => l !== lane);
    } else if (roll < 0.66 + d * 0.08) {
      // two blocked lanes
      const blocked = shuffle([0, 1, 2]).slice(0, 2);
      const type = Math.random() < 0.3 ? 'barrier' : 'speaker';
      for (const lane of blocked) row.obstacles.push(this.spawnObstacle(type, lane, z));
      row.safeLanes = lanes.filter((l) => !blocked.includes(l));
    } else if (roll < 0.84 && d > 0.18) {
      // overhead truss: slide!
      if (d > 0.62 && Math.random() < 0.28) {
        for (const lane of lanes) row.obstacles.push(this.spawnObstacle('truss', lane, z));
        row.safeLanes = lanes;
      } else {
        const lane = Math.floor(Math.random() * 3);
        row.obstacles.push(this.spawnObstacle('truss', lane, z));
        row.safeLanes = lanes.filter((l) => l !== lane);
      }
    } else {
      // mixed combo
      const blocked = shuffle([0, 1, 2]).slice(0, 2);
      row.obstacles.push(this.spawnObstacle('speaker', blocked[0], z));
      row.obstacles.push(this.spawnObstacle(Math.random() < 0.5 ? 'barrier' : 'speaker', blocked[1], z + 2.2));
      row.safeLanes = lanes.filter((l) => !blocked.includes(l));
    }

    // Reward the safe lane with a mic trail
    if (Math.random() < 0.82) {
      const safe = row.safeLanes[Math.floor(Math.random() * row.safeLanes.length)];
      if (safe !== undefined) {
        const count = 3 + Math.floor(Math.random() * 3);
        this.spawnCoinLine(safe, z - 5, count, Math.random() < 0.35, (Math.random() - 0.5) * 0.2);
      }
    }
    // Occasional bonus row high above a blocked lane
    if (Math.random() < 0.12) {
      const lane = Math.floor(Math.random() * 3);
      this.spawnCoinLine(lane, z - 12, 4, true, 0);
    }
    return row;
  }

  reset() {
    for (const o of this.obstacles) {
      o.active = false;
      o.mesh.visible = false;
    }
    this.obstacles.length = 0;
    this.coins.length = 0;
    this.hideCoins();
    this.particles.clear();
    this.totalSpawned = 0;
    this.nextSpawnDistance = 22;
    this.time = 0;

    // Pre-fill the runway so the very first frame is a party.
    this.spawnObstacle('speaker', 0, -30);
    this.spawnObstacle('barrier', 2, -46);
    this.spawnRow(-64, 30);
    this.spawnRow(-86, 50);
    this.spawnRow(-108, 70);
    this.spawnCoinLine(1, -18, 6, false);
    this.spawnCoinLine(0, -52, 4, false);
  }

  setZone(index) {
    this.zoneIndex = index % ZONES.length;
    const z = ZONES[this.zoneIndex];
    this.targetColors.primary.setHex(z.primary);
    this.targetColors.secondary.setHex(z.secondary);
    this.targetColors.accent.setHex(z.accent);
    this.targetColors.fog.setHex(z.fog);
    this.skyTarget = {
      top: new THREE.Color(z.skyTop),
      mid: new THREE.Color(z.skyMid),
      horizon: new THREE.Color(z.skyHorizon),
    };
    return z;
  }

  collect(coin, particleColor) {
    coin.active = false;
    this.particles.burst(coin.x, coin.baseY + 0.1, coin.z, 9, particleColor, 2.2);
  }

  smash(obstacle) {
    if (obstacle.hit) return;
    obstacle.hit = true;
    const color = new THREE.Color(0x59ecff);
    this.particles.burst(obstacle.x, 1.1, obstacle.z, 22, color, 4.6);
  }

  clearObstacle(obstacle) {
    obstacle.active = false;
    obstacle.mesh.visible = false;
    obstacle.mesh.scale.setScalar(1);
  }

  update(dt, speed, distance, playerX, encore, allowSpawn = true) {
    this.time += dt;
    const t = this.time;

    // Spawn ahead based on distance travelled.
    if (allowSpawn) {
      while (distance > this.nextSpawnDistance) {
        const progress = Math.min(1, distance / 2200);
        const gap = Math.max(11.5, 22 - progress * 8 + Math.random() * 7);
        this.spawnRow(SPAWN_Z - Math.random() * 4, distance);
        this.nextSpawnDistance += gap;
        this.totalSpawned++;
      }
    }

    // Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      if (!o.active) {
        if (o.mesh.visible) o.mesh.visible = false;
        this.obstacles.splice(i, 1);
        continue;
      }
      o.z += speed * dt;
      o.mesh.position.z = o.z;
      if (o.type === 'barrier') {
        o.mesh.rotation.z = Math.sin(t * 1.6 + o.x) * 0.012;
      } else if (o.type === 'speaker') {
        o.mesh.position.y = Math.sin(t * 8 + o.lane) * 0.008;
      }
      if (encore && !o.hit) {
        o.mesh.rotation.y += dt * 1.1;
        o.mesh.position.y = Math.abs(Math.sin(t * 3 + o.lane)) * 0.18;
      } else if (o.mesh.rotation.y !== 0) {
        o.mesh.rotation.y = THREE.MathUtils.damp(o.mesh.rotation.y, 0, 6, dt);
      }
      if (o.z > DESPAWN_Z) {
        o.active = false;
        o.mesh.visible = false;
        this.obstacles.splice(i, 1);
      }
    }

    // Coins — one instanced draw for the gold, one for the handles.
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (!c.active || c.z > DESPAWN_Z) this.coins.splice(i, 1);
    }
    const coinCount = Math.min(this.coins.length, this.coinCapacity);
    for (let i = 0; i < coinCount; i++) {
      const c = this.coins[i];
      c.z += speed * dt;
      c.phase += dt * 3.4;

      // Encore magnet
      if (encore) {
        const dx = playerX - c.x;
        const dz = -c.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 9 && dist > 0.4) {
          const pull = (1 - dist / 9) * 12;
          c.x += (dx / dist) * pull * dt;
          c.baseY += (1.1 - c.baseY) * pull * dt * 0.18;
          c.z -= (dz / dist) * pull * dt * 0.5;
        }
      }

      const y = c.baseY + Math.sin(c.phase) * 0.065;
      const pulse = 0.9 + Math.sin(c.phase * 1.6) * 0.08;
      this.coinDummy.position.set(c.x, y, c.z);
      this.coinDummy.rotation.set(0, c.phase * 1.15, Math.sin(c.phase * 0.5) * 0.12);
      this.coinDummy.scale.setScalar(0.92 * pulse);
      this.coinDummy.updateMatrix();
      this.coinGold.setMatrixAt(i, this.coinDummy.matrix);
      this.coinBlack.setMatrixAt(i, this.coinDummy.matrix);
      this.coinGlowPositions[i * 3] = c.x;
      this.coinGlowPositions[i * 3 + 1] = y + 0.08;
      this.coinGlowPositions[i * 3 + 2] = c.z;
    }
    for (let i = coinCount; i < this.coinCapacity; i++) {
      this.coinGold.setMatrixAt(i, this.coinZero);
      this.coinBlack.setMatrixAt(i, this.coinZero);
      this.coinGlowPositions[i * 3 + 1] = -999;
    }
    this.coinGold.instanceMatrix.needsUpdate = true;
    this.coinBlack.instanceMatrix.needsUpdate = true;
    this.coinGlowPoints.geometry.attributes.position.needsUpdate = true;

    // Floor scroll: the texture runs toward the camera.
    this.floorTexture.offset.y = (distance / 9.3) % 1;
    this.edgeGlowMat.opacity = 0.08 + Math.sin(t * 2.2) * 0.03;

    // Arches
    for (const arch of this.arches) {
      arch.position.z += speed * dt;
      if (arch.position.z > DESPAWN_Z + 2) arch.position.z -= 180;
    }

    // City parallax (tiny, based on player lean)
    this.city.position.x = -playerX * 0.4;
    this.city2.position.x = -30 - playerX * 1.4;

    // Lights / beams
    if (this.rimPink) {
      this.rimPink.position.x = -8 + Math.sin(t * 0.6) * 2;
      this.rimCyan.position.x = 8 + Math.cos(t * 0.5) * 2;
      this.rimPink.intensity = 24 + Math.sin(t * 3.2) * 6;
      this.rimCyan.intensity = 22 + Math.sin(t * 2.7 + 1) * 6;
    }
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      b.mesh.position.x = b.baseX + Math.sin(t * 0.35 + b.phase) * 2.2;
      b.mesh.rotation.z = b.side * (0.2 + Math.sin(t * 0.42 + b.phase) * 0.12);
      b.mat.opacity = 0.036 + Math.sin(t * 1.7 + b.phase) * 0.012;
    }

    // Disco ball
    this.discoBall.rotation.y = t * 0.16;
    this.discoBall.rotation.x = Math.sin(t * 0.2) * 0.1;
    const ballPos = this.ballSparklePoints.geometry.attributes.position;
    for (let i = 0; i < ballPos.count; i++) {
      const a = t * 0.5 + i * 0.37;
      const sx = this.ballSparkles[i * 3];
      const sy = this.ballSparkles[i * 3 + 1];
      const sz = this.ballSparkles[i * 3 + 2];
      ballPos.setX(i, sx * Math.cos(a) - sz * Math.sin(a));
      ballPos.setZ(i, sx * Math.sin(a) + sz * Math.cos(a));
      ballPos.setY(i, sy * (1 + Math.sin(t + i) * 0.02));
    }
    ballPos.needsUpdate = true;
    this.ballSparklePoints.material.opacity = 0.65 + Math.sin(t * 3) * 0.25;

    // Ambient glitter drifting
    const amb = this.ambient.geometry.attributes.position;
    for (let i = 0; i < amb.count; i++) {
      let y = amb.getY(i) + dt * (0.18 + this.ambientSeeds[i * 3 + 1] * 0.5);
      if (y > 10.5) y = 0.2;
      amb.setY(i, y);
      amb.setX(i, amb.getX(i) + Math.sin(t * 0.4 + this.ambientSeeds[i * 3]) * dt * 0.08);
    }
    amb.needsUpdate = true;
    this.ambientMat.opacity = 0.42 + Math.sin(t * 1.3) * 0.1;

    // Crowd twinkle
    this.crowdLightsMat.opacity = 0.62 + Math.sin(t * 2.4) * 0.18;

    // Particles
    this.particles.update(dt);

    // Colour grade toward zone palette
    const k = 1 - Math.exp(-dt * 0.55);
    this.colors.primary.lerp(this.targetColors.primary, k);
    this.colors.secondary.lerp(this.targetColors.secondary, k);
    this.colors.accent.lerp(this.targetColors.accent, k);
    this.colors.fog.lerp(this.targetColors.fog, k);
    this.scene.fog.color.copy(this.colors.fog);
    this.railMatA.emissive.copy(this.colors.primary);
    this.railMatB.emissive.copy(this.colors.secondary);
    this.edgeGlowMat.color.copy(this.colors.primary);
    this.archMats[0].emissive.copy(this.colors.primary);
    this.archMats[1].emissive.copy(this.colors.secondary);
    this.mats.magenta.emissive.copy(this.colors.primary);
    this.mats.cyan.emissive.copy(this.colors.secondary);

    if (this.skyTarget) {
      this.skyUniforms.uTop.value.lerp(this.skyTarget.top, k);
      this.skyUniforms.uMid.value.lerp(this.skyTarget.mid, k);
      this.skyUniforms.uHorizon.value.lerp(this.skyTarget.horizon, k);
    }
    this.skyUniforms.uTime.value = t;

    if (encore) {
      this.hemi.intensity = 0.95 + Math.sin(t * 9) * 0.08;
      this.beams.forEach((b) => { b.mat.opacity += 0.02; });
    } else {
      this.hemi.intensity = THREE.MathUtils.damp(this.hemi.intensity, 0.75, 4, dt);
    }
  }
}

export { LANES, ZONES };
