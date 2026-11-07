import * as THREE from 'three';

export const chapterPositions = [54, -12, -76, -140, -210];
export const chapterHeights = [12, 7, 9, 7, 10];

const saturate = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => {
  const t = saturate((n - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const hash = (x: number, z: number) => {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const noise = (x: number, z: number) => {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(0, 1, x - ix), fz = smooth(0, 1, z - iz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), fx),
    THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx), fz,
  );
};
const fractal = (x: number, z: number) =>
  noise(x * .11, z * .11) * .52 + noise(x * .32, z * .32) * .28 + noise(x * .87, z * .87) * .14 + noise(x * 2.1, z * 2.1) * .06;
export const streamX = (z: number) => Math.sin(z * .024) * 2.4 + Math.sin(z * .061) * .65;
const waterWidth = (z: number) => THREE.MathUtils.lerp(3.7, 37, 1 - smooth(-215, -165, z));

function elevation(x: number, z: number) {
  const distance = Math.abs(x - streamX(z));
  const ocean = 1 - smooth(-210, -158, z);
  const mountain = smooth(-22, 35, z);
  const gorge = smooth(-75, -45, z) * (1 - smooth(-15, 20, z));
  const bank = smooth(waterWidth(z) + 1, waterWidth(z) + 15, distance);
  const ridges = Math.pow(fractal(x * .53, z * .55), 1.5);
  const crags = Math.abs(fractal(x * 1.8 + 10, z * 1.3) - .5);
  const relief = bank * (9 + gorge * 24 + mountain * 14 + ridges * (22 + mountain * 26) + crags * 10);
  const details = bank * (fractal(x * 2.7, z * 2.7) - .5) * (2 + gorge * 4);
  return THREE.MathUtils.lerp(relief + details - .7, bank * 2 - 1, ocean);
}

function groundColor(x: number, z: number, height: number, color: THREE.Color) {
  const mountain = smooth(-28, 26, z);
  const canyon = smooth(-80, -45, z) * (1 - smooth(-10, 25, z));
  const soil = smooth(-170, -135, z) * (1 - smooth(-105, -75, z));
  const ocean = 1 - smooth(-210, -155, z);
  const grain = fractal(x * 2.3 + 24, z * 2.3) - .5;
  color.set('#647c72').lerp(new THREE.Color('#887f70'), canyon * .8);
  color.lerp(new THREE.Color('#a68b6a'), soil * .85);
  color.lerp(new THREE.Color('#8e9388'), mountain * .75);
  color.lerp(new THREE.Color('#a7aba2'), ocean * .85);
  color.lerp(new THREE.Color('#e4e8e6'), mountain * smooth(15, 27, height + grain * 14));
  color.multiplyScalar(.75 + grain * .4 + noise(x * .23, z * .23) * .19);
}

export function createLandscape(scene: THREE.Scene) {
  const terrainGeometry = new THREE.PlaneGeometry(190, 355, 190, 355);
  terrainGeometry.rotateX(-Math.PI / 2);
  terrainGeometry.translate(0, 0, -93);
  const positions = terrainGeometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const y = elevation(x, z);
    positions.setY(i, y);
    groundColor(x, z, y, color);
    color.toArray(colors, i * 3);
  }
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeometry.computeVertexNormals();
  const terrainMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(terrainGeometry, terrainMaterial));

  const vertices: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows = 380;
  for (let j = 0; j <= rows; j++) {
    const z = 84 - j * 350 / rows, width = waterWidth(z);
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      vertices.push(streamX(z) + (t - .5) * width * 2, -.5, z);
      uvs.push(t, j / rows * 35);
      if (i < 12 && j < rows) {
        const a = j * 13 + i;
        indices.push(a, a + 13, a + 1, a + 1, a + 13, a + 14);
      }
    }
  }
  const waterGeometry = new THREE.BufferGeometry();
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  waterGeometry.setIndex(indices);
  waterGeometry.computeVertexNormals();
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLight: { value: new THREE.Color('#d4ded6') } },
    vertexShader: `uniform float uTime; varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
      void main() { vUv = uv; vec3 p = position;
        p.y += (sin(p.z * .73 - uTime * 1.3) + sin(p.x * 1.9 + p.z * .47 + uTime)) * .065;
        vWorld = p; vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        vDepth = -viewPosition.z; gl_Position = projectionMatrix * viewPosition; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uLight; varying vec2 vUv; varying vec3 vWorld; varying float vDepth;
      void main() {
        float waves = sin(vUv.y * 18.0 - uTime * 1.7 + sin(vWorld.x * .8) * 2.0);
        float ripples = sin(vUv.y * 49.0 + vWorld.x * 1.8 + uTime * 1.2);
        float sparkle = pow(max(0.0, waves * .5 + ripples * .25), 6.0);
        float edge = smoothstep(0.0, .16, vUv.x) * smoothstep(0.0, .16, 1.0 - vUv.x);
        vec3 color = mix(vec3(.065, .22, .25), vec3(.15, .39, .41), waves * .25 + .4);
        color += uLight * sparkle * .38;
        color = mix(color, vec3(.49, .62, .61), (1.0 - edge) * .38);
        color = mix(color, vec3(.66, .745, .76), smoothstep(46.0, 135.0, vDepth));
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(waterGeometry, waterMaterial));

  const stoneGeometry = new THREE.IcosahedronGeometry(1, 1);
  const stoneMaterial = new THREE.MeshStandardMaterial({ color: '#78847e', roughness: .94, flatShading: true });
  const stones = new THREE.InstancedMesh(stoneGeometry, stoneMaterial, 350);
  const dummy = new THREE.Object3D(), tint = new THREE.Color();
  for (let i = 0; i < 350; i++) {
    const z = 79 - i * 340 / 350;
    const x = streamX(z) + (i % 2 ? 1 : -1) * (waterWidth(z) + 1.5 + hash(i, 6) * 10);
    const size = .35 + hash(i, 9) * 2.5;
    dummy.position.set(x, elevation(x, z) + size * .28, z);
    dummy.rotation.set(hash(i, 3), hash(i, 4) * 6, hash(i, 5));
    dummy.scale.set(size * 1.7, size * .65, size);
    dummy.updateMatrix();
    stones.setMatrixAt(i, dummy.matrix);
    tint.set('#778681').multiplyScalar(.65 + hash(i, 8) * .55);
    stones.setColorAt(i, tint);
  }
  scene.add(stones);

  return {
    waterMaterial,
    dispose() {
      terrainGeometry.dispose(); terrainMaterial.dispose();
      waterGeometry.dispose(); waterMaterial.dispose();
      stoneGeometry.dispose(); stoneMaterial.dispose();
    },
  };
}
