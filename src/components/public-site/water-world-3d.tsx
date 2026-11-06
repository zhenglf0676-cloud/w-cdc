'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const cameraStops = [
  [0, 8, 45], [8, 10, 20], [-6, 9, -4], [6, 7, -31],
  [-6, 9, -66], [6, 8, -98], [-5, 9, -130], [0, 12, -165],
] as const;

const lookStops = [
  [0, 3, -22], [0, 3, -39], [0, 2, -59], [0, 2, -89],
  [0, 2, -115], [0, 2, -145], [0, 2, -180], [0, 3, -211],
] as const;

function noise(x: number, z: number) {
  const a = Math.sin(x * 0.83 + z * 0.19) * Math.cos(z * 0.47 - x * 0.26);
  const b = Math.sin(x * 0.22 - z * 0.34) * Math.cos(x * 0.49 + z * 0.59);
  return a * 0.57 + b * 0.43;
}

function elevation(x: number, z: number) {
  const bank = Math.max(0, (Math.abs(x) - 7.3) / 68);
  const ridges = noise(x * 0.8, z * 0.85) * 7.5 + noise(x * 2.1, z * 1.9) * 2.2;
  return -1.8 + Math.pow(bank, 1.18) * (34 + ridges) + bank * noise(x * 4, z * 4) * 1.2;
}

function makeLandscape(scene: THREE.Scene) {
  const ground = new THREE.PlaneGeometry(176, 270, 150, 180);
  ground.rotateX(-Math.PI / 2);
  ground.translate(0, 0, -82);
  const positions = ground.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const low = new THREE.Color('#0b3537');
  const mid = new THREE.Color('#285349');
  const high = new THREE.Color('#769080');
  const color = new THREE.Color();

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const h = elevation(x, z);
    positions.setY(i, h);
    const slope = Math.min(1, Math.max(0, h / 30));
    color.copy(low).lerp(mid, Math.min(1, slope * 2.5)).lerp(high, Math.max(0, (slope - 0.6) * 0.85));
    const grain = 0.88 + (noise(x * 7, z * 7) + 1) * 0.075;
    colors[i * 3] = color.r * grain;
    colors[i * 3 + 1] = color.g * grain;
    colors[i * 3 + 2] = color.b * grain;
  }

  ground.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const landMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.98, side: THREE.DoubleSide });
  const land = new THREE.Mesh(ground, landMaterial);
  scene.add(land);

  const waterGeometry = new THREE.PlaneGeometry(17.5, 270, 20, 130);
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.translate(0, 0, -82);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    vertexShader: [
      'uniform float uTime;',
      'varying vec3 vWorld;',
      'void main() {',
      '  vec3 p = position;',
      '  p.y += 0.08 * sin(p.z * 0.39 + p.x * 0.8 + uTime * 0.55);',
      '  p.y += 0.04 * sin(p.z * 0.93 - p.x * 1.3 - uTime * 0.82);',
      '  vWorld = p;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'varying vec3 vWorld;',
      'void main() {',
      '  float wave = sin(vWorld.z * 0.42 + vWorld.x * 0.95 + uTime * 0.5);',
      '  float small = sin(vWorld.z * 1.41 - vWorld.x * 1.7 - uTime * 0.9);',
      '  float light = pow(max(0.0, wave * 0.5 + small * 0.25 + 0.35), 4.0);',
      '  vec3 deep = vec3(0.025, 0.19, 0.20);',
      '  vec3 color = mix(deep, vec3(0.29, 0.56, 0.52), light * 0.8);',
      '  gl_FragColor = vec4(color, 0.87);',
      '}',
    ].join('\n'),
  });
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.position.y = 0.08;
  scene.add(water);

  const pineGeometry = new THREE.ConeGeometry(0.5, 3.8, 5);
  const pineMaterial = new THREE.MeshStandardMaterial({ color: '#163c39', roughness: 1 });
  const pines = new THREE.InstancedMesh(pineGeometry, pineMaterial, 830);
  const dummy = new THREE.Object3D();
  const tones = [new THREE.Color('#102f31'), new THREE.Color('#1b4540'), new THREE.Color('#315347')];
  let count = 0;
  let seed = 7621;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1450 && count < 830; i++) {
    const x = (random() - 0.5) * 162;
    const z = 48 - random() * 252;
    const y = elevation(x, z);
    if (Math.abs(x) < 14 || y < 1.7 || y > 27) continue;
    const size = 0.65 + random() * 1.55;
    dummy.position.set(x, y + size * 1.6, z);
    dummy.scale.set(size * (0.65 + random() * 0.3), size, size * (0.65 + random() * 0.3));
    dummy.rotation.y = random() * Math.PI * 2;
    dummy.updateMatrix();
    pines.setMatrixAt(count, dummy.matrix);
    pines.setColorAt(count, tones[Math.floor(random() * tones.length)]);
    count++;
  }
  pines.count = count;
  pines.instanceMatrix.needsUpdate = true;
  scene.add(pines);

  return {
    waterMaterial,
    dispose: () => {
      scene.remove(land, water, pines);
      ground.dispose();
      landMaterial.dispose();
      waterGeometry.dispose();
      waterMaterial.dispose();
      pineGeometry.dispose();
      pineMaterial.dispose();
      pines.dispose();
    },
  };
}

export function WaterWorld3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.setClearColor('#102d34', 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#86a9a3', 0.012);
    scene.add(new THREE.HemisphereLight('#d5f3ee', '#0b302f', 2.4));
    const sunlight = new THREE.DirectionalLight('#d7e9d7', 2.7);
    sunlight.position.set(-35, 60, -80);
    scene.add(sunlight);
    const landscape = makeLandscape(scene);
    const camera = new THREE.PerspectiveCamera(61, 1, 0.1, 260);
    const path = new THREE.CatmullRomCurve3(cameraStops.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.38);
    const lookPath = new THREE.CatmullRomCurve3(lookStops.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.38);
    const stages = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-stage]'));
    const marker = new THREE.Vector3();
    let target = 0;
    let current = 0;
    let pointer = 0;
    let frame = 0;
    let stopped = false;
    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    const updateScroll = () => {
      const position = window.scrollY + window.innerHeight * 0.5;
      const centers = stages.map((stage) => stage.offsetTop + stage.offsetHeight * 0.42);
      const last = centers.length - 1;
      if (position <= centers[0]) { target = 0; return; }
      if (position >= centers[last]) { target = 1; return; }
      for (let i = 0; i < last; i++) {
        if (position <= centers[i + 1]) {
          target = (i + (position - centers[i]) / (centers[i + 1] - centers[i])) / last;
          return;
        }
      }
    };
    const updatePointer = (event: PointerEvent) => {
      pointer = (event.clientX / window.innerWidth - 0.5) * 1.7;
    };
    const render = (time: number) => {
      if (stopped) return;
      current += (target - current) * 0.065;
      camera.position.copy(path.getPoint(Math.max(0, Math.min(1, current))));
      camera.position.x += pointer * 0.3;
      marker.copy(lookPath.getPoint(Math.max(0, Math.min(1, current))));
      camera.lookAt(marker);
      landscape.waterMaterial.uniforms.uTime.value = time * 0.001;
      if (!document.hidden) renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    resize();
    updateScroll();
    frame = window.requestAnimationFrame(render);
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('pointermove', updatePointer, { passive: true });
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('pointermove', updatePointer);
      landscape.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-3d-canvas" aria-hidden="true" />;
}
