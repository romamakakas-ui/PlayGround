import * as THREE from 'three';

/* A stylised, fan-made pop-icon: silver sequin suit, feathered shoulders,
   gold microphone, and an enormous glittering cape. Built entirely from
   primitives so it stays crisp on every screen. */

const COLORS = {
  silver: 0xdfe4f2,
  silverDark: 0x8c93ab,
  gold: 0xffc857,
  goldHot: 0xffe6a3,
  skin: 0xf0c19b,
  skinShade: 0xd79f79,
  hair: 0x150e18,
  black: 0x17131c,
  glass: 0x121629,
  capeA: '#b01562',
  capeB: '#36082d',
  ivory: 0xf7efdd,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext('2d');
  paint(c, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function capeTexture() {
  return canvasTexture(256, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#e1257e');
    g.addColorStop(0.32, '#9c0f5a');
    g.addColorStop(0.72, '#4a073c');
    g.addColorStop(1, '#22031e');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);

    // Broad satin folds so the unlit cape still has depth.
    for (let i = 0; i < 7; i++) {
      const x = ((i + 0.5) / 7) * w;
      const fold = c.createLinearGradient(x - 26, 0, x + 26, 0);
      fold.addColorStop(0, 'rgba(0, 0, 0, 0)');
      fold.addColorStop(0.42, 'rgba(255, 196, 232, 0.13)');
      fold.addColorStop(0.56, 'rgba(36, 0, 24, 0.2)');
      fold.addColorStop(1, 'rgba(0, 0, 0, 0)');
      c.fillStyle = fold;
      c.fillRect(x - 30, 0, 60, h);
    }
    const sheen = c.createLinearGradient(0, 0, w, h);
    sheen.addColorStop(0, 'rgba(255, 232, 248, 0.17)');
    sheen.addColorStop(0.34, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.7, 'rgba(24, 0, 16, 0.12)');
    sheen.addColorStop(1, 'rgba(255, 208, 238, 0.07)');
    c.fillStyle = sheen;
    c.fillRect(0, 0, w, h);

    // Vertical sequin sheen
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() * 2.4;
      c.fillStyle = `rgba(255, ${160 + Math.random() * 80 | 0}, 210, ${0.05 + Math.random() * 0.18})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    // Gold hem
    const hem = c.createLinearGradient(0, h - 58, 0, h);
    hem.addColorStop(0, 'rgba(255, 200, 87, 0)');
    hem.addColorStop(0.55, 'rgba(255, 200, 87, 0.65)');
    hem.addColorStop(1, 'rgba(255, 238, 179, 0.95)');
    c.fillStyle = hem;
    c.fillRect(0, h - 58, w, 58);

    // Star monogram
    c.save();
    c.translate(w / 2, h * 0.28);
    c.fillStyle = 'rgba(255, 232, 170, 0.9)';
    c.shadowColor = 'rgba(255, 200, 87, 0.9)';
    c.shadowBlur = 14;
    const spikes = 5;
    const outer = 25;
    const inner = 10;
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (i * Math.PI) / spikes - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.restore();

    // Bottom fringe
    c.strokeStyle = 'rgba(255, 226, 150, 0.8)';
    c.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const x = (i / 21) * w;
      c.beginPath();
      c.moveTo(x, h - 20);
      c.lineTo(x + (i % 2 ? 3 : -3), h);
      c.stroke();
    }

    // Gold piping around the tail-coat edges.
    c.strokeStyle = 'rgba(255, 218, 140, 0.55)';
    c.lineWidth = 3;
    c.strokeRect(2, 2, w - 4, h - 4);
  });
}

export class Runner {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'FilippRunner';
    scene.add(this.group);

    this.pose = new THREE.Group();
    this.group.add(this.pose);

    this.phase = 0;
    this.mode = 'idle';
    this.turn = 0;
    this.encore = false;
    this.hitTimer = 0;
    this.t = 0;
    this.tmpTarget = new THREE.Vector3();

    this.materials = [];
    this.build();
  }

  material(options) {
    const m = new THREE.MeshStandardMaterial(options);
    this.materials.push(m);
    return m;
  }

  addMesh(geometry, material, parent = this.pose) {
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  }

  build() {
    const silver = this.material({ color: COLORS.silver, metalness: 0.82, roughness: 0.3, envMapIntensity: 1.25 });
    this.silver = silver;
    const silverDark = this.material({ color: COLORS.silverDark, metalness: 0.9, roughness: 0.34 });
    const gold = this.material({ color: COLORS.gold, metalness: 1, roughness: 0.22, emissive: 0x5a3400, emissiveIntensity: 0.35, envMapIntensity: 1.5 });
    this.gold = gold;
    const skin = this.material({ color: COLORS.skin, roughness: 0.62, metalness: 0.02 });
    const skinShade = this.material({ color: COLORS.skinShade, roughness: 0.7 });
    const hair = this.material({ color: COLORS.hair, roughness: 0.52, metalness: 0.22 });
    const black = this.material({ color: COLORS.black, roughness: 0.45, metalness: 0.3 });
    const glass = this.material({ color: COLORS.glass, roughness: 0.08, metalness: 0.95, emissive: 0x0a2630, emissiveIntensity: 0.5 });
    const feather = this.material({ color: COLORS.ivory, roughness: 0.72, metalness: 0.08, emissive: 0x2a1a0a, emissiveIntensity: 0.25 });

    // ---- legs -------------------------------------------------------------
    this.legs = [];
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.17 * side, 1.0, 0);
      this.pose.add(hip);

      const thigh = this.addMesh(new THREE.CapsuleGeometry(0.098, 0.34, 4, 8), black, hip);
      thigh.position.y = -0.23;
      thigh.scale.set(1.06, 1, 1.06);
      const thighStripe = this.addMesh(new THREE.BoxGeometry(0.016, 0.29, 0.032), gold, hip);
      thighStripe.position.set(0.1 * side, -0.23, 0.015);

      const knee = new THREE.Group();
      knee.position.y = -0.48;
      hip.add(knee);

      const shin = this.addMesh(new THREE.CapsuleGeometry(0.078, 0.32, 4, 8), black, knee);
      shin.position.y = -0.2;
      const stripe = this.addMesh(new THREE.BoxGeometry(0.022, 0.3, 0.01), gold, shin);
      stripe.position.set(0.072 * side, 0, -0.075);
      const backStripe = this.addMesh(new THREE.BoxGeometry(0.022, 0.3, 0.01), gold, shin);
      backStripe.position.set(0, 0, 0.078);

      const shoe = new THREE.Group();
      shoe.position.set(0, -0.4, -0.055);
      knee.add(shoe);
      const sole = this.addMesh(new THREE.BoxGeometry(0.17, 0.07, 0.33), black, shoe);
      sole.position.z = -0.05;
      const top = this.addMesh(new THREE.BoxGeometry(0.155, 0.09, 0.2), silver, shoe);
      top.position.set(0, 0.065, 0.015);
      const toe = this.addMesh(new THREE.SphereGeometry(0.083, 10, 7), gold, shoe);
      toe.scale.set(1, 0.52, 1.35);
      toe.position.set(0, 0.025, -0.16);

      this.legs.push({ hip, knee, side });
    }

    // ---- hips / torso -----------------------------------------------------
    const hips = this.addMesh(new THREE.BoxGeometry(0.47, 0.3, 0.3), black);
    hips.position.y = 1.03;

    const belt = this.addMesh(new THREE.CylinderGeometry(0.255, 0.255, 0.075, 12), gold);
    belt.position.y = 1.16;
    belt.scale.z = 0.72;

    const torso = new THREE.Group();
    torso.position.y = 1.48;
    this.pose.add(torso);
    this.torso = torso;

    const chest = this.addMesh(new THREE.CylinderGeometry(0.35, 0.255, 0.66, 10, 1), silver, torso);
    chest.scale.z = 0.6;
    const chestInset = this.addMesh(new THREE.BoxGeometry(0.22, 0.5, 0.04), black, torso);
    chestInset.position.set(0, 0, -0.205);
    const v1 = this.addMesh(new THREE.BoxGeometry(0.035, 0.4, 0.014), gold, torso);
    v1.position.set(-0.09, 0.04, -0.225);
    v1.rotation.z = 0.24;
    const v2 = this.addMesh(new THREE.BoxGeometry(0.035, 0.4, 0.014), gold, torso);
    v2.position.set(0.09, 0.04, -0.225);
    v2.rotation.z = -0.24;

    // sequin speckles
    const speckleGeo = new THREE.BufferGeometry();
    const speckles = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 0.6;
      const rx = 0.34 * Math.sqrt(1 - (y / 0.35) ** 2);
      speckles.push(Math.cos(a) * rx * 0.95, y, Math.sin(a) * rx * 0.62 - 0.01);
    }
    speckleGeo.setAttribute('position', new THREE.Float32BufferAttribute(speckles, 3));
    const speckleMat = new THREE.PointsMaterial({
      color: 0xfff1c4,
      size: 0.018,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const specklePoints = new THREE.Points(speckleGeo, speckleMat);
    torso.add(specklePoints);
    this.speckleMat = speckleMat;

    // ---- shoulders / feathers --------------------------------------------
    this.arms = [];
    for (const side of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.37 * side, 1.68, 0);
      this.pose.add(shoulder);

      const pad = this.addMesh(new THREE.SphereGeometry(0.16, 12, 10), silver, shoulder);
      pad.scale.set(1.15, 0.78, 1.1);
      const epaulette = this.addMesh(new THREE.CylinderGeometry(0.115, 0.135, 0.05, 10), gold, shoulder);
      epaulette.position.y = 0.1;

      // Feather fan (five plumes)
      for (let i = 0; i < 5; i++) {
        const plume = this.addMesh(new THREE.ConeGeometry(0.055, 0.52 + i * 0.06, 5), feather, shoulder);
        const angle = (-0.75 + i * 0.38) * side;
        plume.position.set(side * (0.12 + i * 0.035), 0.26 + i * 0.015, 0.03 + i * 0.025);
        plume.rotation.z = side * (0.62 + i * 0.12);
        plume.rotation.x = -0.18 + i * 0.08;
        plume.scale.set(1, 1, 0.55);
      }

      const upper = new THREE.Group();
      shoulder.add(upper);
      const upperArm = this.addMesh(new THREE.CapsuleGeometry(0.072, 0.3, 4, 8), silver, upper);
      upperArm.position.y = -0.21;
      const elbow = new THREE.Group();
      elbow.position.y = -0.4;
      upper.add(elbow);
      const forearm = this.addMesh(new THREE.CapsuleGeometry(0.062, 0.26, 4, 8), silver, elbow);
      forearm.position.y = -0.17;
      const cuff = this.addMesh(new THREE.CylinderGeometry(0.078, 0.07, 0.05, 8), gold, elbow);
      cuff.position.y = -0.32;
      const hand = this.addMesh(new THREE.SphereGeometry(0.072, 10, 8), skin, elbow);
      hand.position.y = -0.38;
      hand.scale.set(0.9, 1.1, 0.72);

      if (side === 1) {
        // Gold microphone in the right hand
        const mic = new THREE.Group();
        mic.position.set(0, -0.4, -0.03);
        mic.rotation.x = -0.55;
        elbow.add(mic);
        const head = this.addMesh(new THREE.SphereGeometry(0.06, 10, 8), gold, mic);
        head.scale.set(0.9, 1, 0.9);
        const grill = this.addMesh(new THREE.CylinderGeometry(0.05, 0.055, 0.035, 10), black, mic);
        grill.position.y = 0.055;
        const handle = this.addMesh(new THREE.CylinderGeometry(0.024, 0.03, 0.24, 8), black, mic);
        handle.position.y = -0.14;
        const ring = this.addMesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 8), gold, mic);
        ring.position.y = -0.03;
      }

      this.arms.push({ shoulder, upper, elbow, side });
    }

    // ---- neck / head ------------------------------------------------------
    const neck = this.addMesh(new THREE.CylinderGeometry(0.083, 0.093, 0.16, 8), skin);
    neck.position.y = 1.82;

    const head = new THREE.Group();
    head.position.y = 1.99;
    this.pose.add(head);
    this.head = head;

    const skull = this.addMesh(new THREE.SphereGeometry(0.195, 18, 16), skin, head);
    skull.scale.set(0.9, 1.08, 0.95);
    const jaw = this.addMesh(new THREE.SphereGeometry(0.12, 12, 10), skin, head);
    jaw.position.set(0, -0.11, -0.045);
    jaw.scale.set(0.9, 0.72, 0.9);

    // Hair: cap + swept quiff + sideburns
    const hairCap = this.addMesh(
      new THREE.SphereGeometry(0.205, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hair,
      head,
    );
    hairCap.scale.set(0.94, 1.08, 1.0);
    hairCap.position.y = 0.018;
    const backHair = this.addMesh(new THREE.SphereGeometry(0.18, 14, 12), hair, head);
    backHair.position.set(0, 0.015, 0.09);
    backHair.scale.set(0.98, 1.02, 0.72);
    const quiff = this.addMesh(new THREE.SphereGeometry(0.09, 10, 8), hair, head);
    quiff.position.set(0.015, 0.17, -0.075);
    quiff.scale.set(1.35, 0.72, 1.1);
    for (const side of [-1, 1]) {
      const burn = this.addMesh(new THREE.BoxGeometry(0.035, 0.13, 0.06), hair, head);
      burn.position.set(0.16 * side, -0.015, 0.01);
      burn.rotation.z = side * -0.12;
    }

    // Ears
    for (const side of [-1, 1]) {
      const ear = this.addMesh(new THREE.SphereGeometry(0.05, 8, 7), skinShade, head);
      ear.position.set(0.17 * side, -0.01, 0.015);
      ear.scale.set(0.55, 1, 0.8);
    }

    // Sunglasses
    const shades = new THREE.Group();
    shades.position.set(0, 0.015, -0.172);
    head.add(shades);
    for (const side of [-1, 1]) {
      const lens = this.addMesh(new THREE.BoxGeometry(0.135, 0.082, 0.026), glass, shades);
      lens.position.set(0.082 * side, 0, 0);
      lens.rotation.y = side * -0.14;
      const rim = this.addMesh(new THREE.BoxGeometry(0.148, 0.009, 0.012), gold, shades);
      rim.position.set(0.082 * side, 0.048, -0.006);
      const shine = this.addMesh(new THREE.BoxGeometry(0.05, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: 0x9beeff, transparent: true, opacity: 0.8 }), shades);
      shine.position.set(0.055 * side, 0.022, -0.02);
      shine.rotation.z = -0.35;
      const arm = this.addMesh(new THREE.BoxGeometry(0.02, 0.018, 0.15), gold, shades);
      arm.position.set(0.155 * side, 0.015, 0.07);
    }
    const bridge = this.addMesh(new THREE.BoxGeometry(0.045, 0.014, 0.018), gold, shades);
    bridge.position.y = 0.01;

    // Mouth: subtle smile
    const mouth = this.addMesh(new THREE.BoxGeometry(0.07, 0.012, 0.008), skinShade, head);
    mouth.position.set(0, -0.105, -0.171);
    mouth.rotation.z = -0.06;

    // ---- cape -------------------------------------------------------------
    const capeGeo = new THREE.PlaneGeometry(1.22, 1.5, 16, 22);
    const capePos = capeGeo.attributes.position;
    this.capeBaseZ = new Float32Array(capePos.count);
    for (let i = 0; i < capePos.count; i++) {
      const x = capePos.getX(i);
      const y = capePos.getY(i);
      const nx = x / 0.61;
      const t = clamp01((0.75 - y) / 1.5);
      // Narrow at the shoulders, flared at the hem, split into two tail-coat panels.
      const width = 0.5 + 0.44 * t;
      // Softly rounded top corners keep the shoulder pads visible.
      const corner = 1 - 0.17 * Math.pow(clamp01((0.13 - t) / 0.13), 1.6) * Math.abs(nx);
      let notch = 0;
      if (t > 0.24) {
        const k = (t - 0.24) / 0.76;
        notch = k * k * 1.18 * Math.max(0, 1 - Math.abs(nx) * 1.5);
      }
      capePos.setX(i, x * width * corner);
      capePos.setY(i, y + notch);
      const billow = Math.sin(t * Math.PI) * 0.11 * (1 - nx * nx * 0.55);
      this.capeBaseZ[i] = billow;
      capePos.setZ(i, billow);
    }
    capeGeo.computeVertexNormals();
    this.capeBase = capeGeo.attributes.position.array.slice();
    const capeMat = new THREE.MeshBasicMaterial({
      map: capeTexture(),
      color: 0xffffff,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.materials.push(capeMat);
    this.capeMat = capeMat;
    this.cape = new THREE.Mesh(capeGeo, capeMat);
    this.cape.position.set(0, 1.08, 0.24);
    this.cape.rotation.x = -0.06;
    this.pose.add(this.cape);

    const collar = this.addMesh(new THREE.TorusGeometry(0.22, 0.028, 8, 18, Math.PI), gold);
    collar.position.set(0, 1.74, 0.06);
    collar.rotation.x = Math.PI / 2;
    collar.rotation.z = Math.PI;

    // subtle aura shell (shown in encore)
    const auraMat = new THREE.MeshBasicMaterial({
      color: 0x59ecff,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.aura = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), auraMat);
    this.aura.position.y = 1.2;
    this.auraMat = auraMat;
    this.group.add(this.aura);

    this.pose.rotation.order = 'YXZ';
  }

  setMode(mode) {
    this.mode = mode;
  }

  setEncore(on) {
    this.encore = on;
    if (on) {
      this.gold.emissiveIntensity = 0.9;
      this.capeMat.color.setHex(0xbcfff4);
    } else {
      this.gold.emissiveIntensity = 0.35;
      this.capeMat.color.setHex(0xffffff);
    }
  }

  hit() {
    this.hitTimer = 0.45;
  }

  update(dt, t, speed, sliding) {
    this.t = t;
    const running = this.mode === 'run';
    const jumping = this.mode === 'jump';
    const slide = this.mode === 'slide' || sliding;
    const idle = this.mode === 'idle';

    if (running) this.phase += dt * Math.min(speed, 28) * 0.62;
    else if (idle) this.phase += dt * 1.5;

    const p = this.phase;
    const sway = Math.sin(t * 1.4);
    const breathe = Math.sin(t * 2.1) * 0.012;

    // Smoothly blend the pose group between running / sliding / idle.
    const targetPoseY = slide ? -0.47 : (idle ? 0 : 0);
    const targetPoseX = slide ? -1.16 : (running ? 0.07 : 0);
    this.pose.position.y = THREE.MathUtils.damp(this.pose.position.y, targetPoseY, 14, dt);
    this.pose.rotation.x = THREE.MathUtils.damp(this.pose.rotation.x, targetPoseX, 12, dt);
    this.pose.rotation.z = THREE.MathUtils.damp(this.pose.rotation.z, -this.turn * 0.07, 7, dt);
    this.pose.rotation.y = THREE.MathUtils.damp(this.pose.rotation.y, this.turn * 0.04, 8, dt);

    const bodyBob = running ? Math.abs(Math.sin(p)) * 0.045 : breathe;
    this.pose.position.y += bodyBob;

    // Legs
    const legAmp = running ? 0.95 : 0;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      const sidePhase = p + (i === 0 ? 0 : Math.PI);
      let hipTarget = 0;
      let kneeTarget = 0;
      if (running) {
        hipTarget = Math.sin(sidePhase) * legAmp;
        kneeTarget = -Math.max(0, Math.sin(sidePhase + Math.PI * 0.55)) * 1.15;
      } else if (jumping) {
        hipTarget = i === 0 ? -0.75 : -0.25;
        kneeTarget = i === 0 ? 1.2 : 0.55;
      } else if (idle) {
        hipTarget = 0.02;
        kneeTarget = 0.02;
      } else if (slide) {
        hipTarget = -1.28;
        kneeTarget = 0.18;
      }
      leg.hip.rotation.x = THREE.MathUtils.damp(leg.hip.rotation.x, hipTarget, running ? 18 : 12, dt);
      leg.knee.rotation.x = THREE.MathUtils.damp(leg.knee.rotation.x, kneeTarget, running ? 18 : 12, dt);
      leg.hip.rotation.z = THREE.MathUtils.damp(leg.hip.rotation.z, slide ? leg.side * 0.08 : leg.side * 0.02, 10, dt);
    }

    // Arms: opposite to legs, plus a diva pose while idle
    for (let i = 0; i < this.arms.length; i++) {
      const arm = this.arms[i];
      const sidePhase = p + (i === 0 ? Math.PI : 0);
      let shoulderX = 0;
      let shoulderZ = arm.side * 0.14;
      let elbowX = -0.2;
      if (running) {
        shoulderX = Math.sin(sidePhase) * 0.72;
        elbowX = -0.5 - Math.max(0, Math.sin(sidePhase)) * 0.5;
        shoulderZ = arm.side * 0.13;
      } else if (jumping) {
        shoulderX = -0.9;
        shoulderZ = arm.side * 0.42;
        elbowX = -0.5;
      } else if (idle) {
        if (arm.side === -1) {
          shoulderX = -0.38 + sway * 0.05;
          shoulderZ = 0.72;
          elbowX = -1.38;
        } else {
          shoulderX = -0.15;
          shoulderZ = -0.62;
          elbowX = -1.15;
        }
      } else if (slide) {
        shoulderX = 0.2;
        shoulderZ = arm.side * 0.9;
        elbowX = -0.35;
      }
      arm.shoulder.rotation.x = THREE.MathUtils.damp(arm.shoulder.rotation.x, shoulderX, running ? 18 : 10, dt);
      arm.shoulder.rotation.z = THREE.MathUtils.damp(arm.shoulder.rotation.z, shoulderZ, running ? 16 : 10, dt);
      arm.elbow.rotation.x = THREE.MathUtils.damp(arm.elbow.rotation.x, elbowX, 14, dt);
    }

    // Head looks slightly ahead, tilts on turns
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, this.turn * 0.16, 6, dt);
    this.head.rotation.z = THREE.MathUtils.damp(this.head.rotation.z, -this.turn * 0.08 + (idle ? sway * 0.03 : 0), 6, dt);
    this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, jumping ? -0.12 : 0, 8, dt);

    // Move the head with the torso during jumps/slides (the pose group already does).

    // Cape: ripples in the wind, flares on jump, drags on slide.
    const pos = this.cape.geometry.attributes.position;
    const base = this.capeBase;
    const wind = running ? 1 : 0.35;
    const phase = t * (running ? 7.5 : 2.6);
    const flare = jumping ? 0.26 : (slide ? -0.1 : 0.1);
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      const normY = (by + 0.75) / 1.5; // 1 at top, 0 at hem
      const bottom = 1 - normY;
      const wave = Math.sin(phase + by * 3.2 + bx * 2.2) * 0.05 * wind;
      const wave2 = Math.cos(phase * 0.6 + bx * 4.1) * 0.028 * wind;
      pos.setZ(i, this.capeBaseZ[i] + flare * bottom * bottom + wave * bottom + wave2 * bottom);
      pos.setX(i, bx * (1 + bottom * 0.06) + Math.sin(t * 2.2 + by * 2) * 0.025 * bottom + this.turn * 0.12 * bottom);
      pos.setY(i, by + Math.sin(t * 3.1 + bx * 3) * 0.012 * bottom);
    }
    pos.needsUpdate = true;
    this.cape.geometry.computeVertexNormals();

    // Encore aura
    const auraTarget = this.encore ? 0.16 + Math.sin(t * 8) * 0.05 : 0;
    this.auraMat.opacity = THREE.MathUtils.damp(this.auraMat.opacity, auraTarget, 8, dt);
    this.aura.rotation.y += dt * 1.4;

    // Hit flash
    const silver = this.silver;
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      const on = Math.sin(this.hitTimer * 55) > 0;
      silver.emissive.setHex(on ? 0xff2233 : 0x000000);
      silver.emissiveIntensity = on ? 0.9 : 0;
    } else if (silver.emissiveIntensity !== 0) {
      silver.emissive.setHex(this.encore ? 0x0b3f4a : 0x000000);
      silver.emissiveIntensity = this.encore ? 0.2 : 0;
    }

    // Sequin twinkle
    this.speckleMat.opacity = 0.55 + Math.sin(t * 6) * 0.25;
  }
}
