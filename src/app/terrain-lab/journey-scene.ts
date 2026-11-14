import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
function noise(x: number, z: number) {
  const a = Math.floor(x), b = Math.floor(z), u = smooth(0, 1, x - a), v = smooth(0, 1, z - b);
  return mix(mix(hash(a, b), hash(a + 1, b), u), mix(hash(a, b + 1), hash(a + 1, b + 1), u), v);
}
function fbm(x: number, z: number) {
  return noise(x * .025, z * .025) * .53 + noise(x * .063, z * .063) * .27 + noise(x * .17, z * .17) * .13 + noise(x * .48, z * .48) * .07;
}
export const riverX = (z: number) => Math.sin(z * .014) * 16 + Math.sin(z * .036) * 4;
export const riverLevel = (z: number) => 54 * (1 - smooth(0, 230, z)) + 11 * (1 - smooth(150, 430, z));
const riverWidth = (z: number) => 2 + smooth(40, 220, z) * 5 + smooth(330, 460, z) * 9 + smooth(470, 610, z) * 190;
function height(x: number, z: number) {
  const d = Math.abs(x - riverX(z)), width = riverWidth(z);
  const banks = smooth(width - .6, width + 28, d);
  const mountain = 1 - smooth(90, 290, z);
  const canyon = smooth(65, 145, z) * (1 - smooth(245, 350, z));
  const coast = 1 - smooth(410, 565, z);
  const ridge = 1 - Math.abs(fbm(x * 1.8, z * 1.4) * 2 - 1);
  const peaks = Math.pow(ridge, 3) * (42 + mountain * 108);
  const rock = Math.sin(z * .08 + x * .1) * 2 + noise(x * .7, z * .7) * 3;
  return riverLevel(z) - 1.8 + banks * ((10 + peaks + canyon * 44 + rock) * coast + 1.2);
}

/** Deterministic, local scenery. No imagery, tiles, elevation services or model downloads. */
export function createJourney(scene: THREE.Scene, compact: boolean) {
  const resources: Array<{ dispose: () => void }> = [];
  const own = <T extends { dispose: () => void }>(item: T): T => { resources.push(item); return item; };
  const geometry = own(new THREE.PlaneGeometry(620, 1000, compact ? 180 : 300, compact ? 300 : 480));
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, 0, 270);
  const points = geometry.getAttribute('position');
  const colors = new Float32Array(points.count * 3);
  const color = new THREE.Color(), snow = new THREE.Color('#edf5fa'), rock = new THREE.Color('#677782');
  const green = new THREE.Color('#344f43'), sandstone = new THREE.Color('#938875'), sand = new THREE.Color('#afac91');
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i), y = height(x, z);
    points.setY(i, y);
    const slope = Math.hypot(height(x + 1, z) - height(x - 1, z), height(x, z + 1) - height(x, z - 1)) / 2;
    color.copy(green).lerp(rock, smooth(.25, 2, slope));
    color.lerp(sandstone, smooth(100, 170, z) * (1 - smooth(290, 380, z)) * .6);
    color.lerp(sand, smooth(400, 540, z));
    const snowline = 89 + smooth(0, 230, z) * 65 + noise(x * .1, z * .1) * 12;
    color.lerp(snow, smooth(snowline - 9, snowline + 5, y) * (1 - smooth(1.6, 4.2, slope)));
    color.multiplyScalar(.78 + fbm(x * 6, z * 6) * .35);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals();
  const material = own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }));
  scene.add(new THREE.Mesh(geometry, material));

  const verts: number[] = [], uvs: number[] = [], indices: number[] = [];
  const rows = compact ? 340 : 560, cols = 24;
  for (let j = 0; j <= rows; j++) {
    const z = -220 + j / rows * 1000, w = riverWidth(z);
    for (let i = 0; i <= cols; i++) {
      const t = i / cols;
      verts.push(riverX(z) + (t * 2 - 1) * w, riverLevel(z) - .35, z); uvs.push(t, z);
      if (i < cols && j < rows) { const k = j * (cols + 1) + i; indices.push(k, k + 1, k + cols + 1, k + 1, k + cols + 2, k + cols + 1); }
    }
  }
  const waterGeometry = own(new THREE.BufferGeometry());
  waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); waterGeometry.setIndex(indices);
  const water = own(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, fogColor: { value: new THREE.Color('#afc6ce') } },
    vertexShader: `uniform float time; varying vec3 world; varying vec2 tex; varying float depth;
      void main(){vec3 p=position; p.y+=sin(p.z*.6-time*1.6)*.065+sin(p.x*.8+p.z*.35+time)*.04;
      world=p; tex=uv; vec4 mv=modelViewMatrix*vec4(p,1.);depth=-mv.z;gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float time;uniform vec3 fogColor;varying vec3 world;varying vec2 tex;varying float depth;
      void main(){float sea=smoothstep(430.,600.,world.z);
      float a=sin(world.z*2.1-time*3.+sin(world.x*1.6));float b=sin(world.x*3.2+world.z*.8-time*1.2);
      vec3 n=normalize(vec3((a+b)*.14,1.,cos(world.z*1.1-time)*.18));
      vec3 v=normalize(cameraPosition-world);float fres=pow(1.-max(dot(n,v),0.),3.);
      vec3 base=mix(vec3(.035,.24,.25),vec3(.025,.12,.20),sea);
      vec3 c=mix(base,vec3(.52,.70,.76),fres*.75);
      float glint=pow(max(dot(reflect(-normalize(vec3(-.5,1.,.4)),n),v),0.),100.);
      float edge=1.-smoothstep(0.,.07,min(tex.x,1.-tex.x));
      float foam=smoothstep(.65,.98,a*.5+b*.25)*edge*(1.-sea)*.55;
      c+=vec3(.85,.91,.89)*(glint*.8+foam);c=mix(c,fogColor,smoothstep(100.,470.,depth));
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`, side: THREE.DoubleSide,
  }));
  scene.add(new THREE.Mesh(waterGeometry, water));

  // Repeated rocks and trees share geometry and material; only a few draw calls.
  const dummy = new THREE.Object3D();
  const rocks = new THREE.InstancedMesh(own(new THREE.IcosahedronGeometry(1, 1)), own(new THREE.MeshStandardMaterial({ color: '#75817e', roughness: 1 })), compact ? 260 : 600);
  for (let i = 0; i < rocks.count; i++) {
    const z = hash(i, 8) * 560 - 40, size = .4 + hash(i, 13) * 3;
    const x = riverX(z) + (i % 2 ? -1 : 1) * (riverWidth(z) + hash(i, 12) * 11);
    dummy.position.set(x, height(x, z) + size * .2, z); dummy.scale.set(size * 1.4, size * .65, size);
    dummy.rotation.set(hash(i, 4), hash(i, 9) * 6, hash(i, 3)); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks); resources.push(rocks);
  const treeCount = compact ? 550 : 1400;
  const trees = new THREE.InstancedMesh(own(new THREE.ConeGeometry(1, 1, 7)), own(new THREE.MeshStandardMaterial({ color: '#234d3e', roughness: 1 })), treeCount);
  for (let i = 0; i < treeCount; i++) {
    const z = 175 + hash(i, 22) * 270, x = riverX(z) + (i % 2 ? -1 : 1) * (riverWidth(z) + 6 + hash(i, 21) * 110);
    const y = height(x, z), h = 3 + hash(i, 25) * 8;
    dummy.position.set(x, y + h * .42, z); dummy.rotation.set(0, hash(i, 26) * 6, 0); dummy.scale.set(h * .23, h, h * .23); dummy.updateMatrix(); trees.setMatrixAt(i, dummy.matrix);
    color.set('#234c3e').multiplyScalar(.65 + hash(i, 28) * .6); trees.setColorAt(i, color);
  }
  scene.add(trees); resources.push(trees);
  return { water, dispose: () => resources.forEach(item => item.dispose()) };
}

export function mountJourney(canvas: HTMLCanvasElement, report: (status: string) => void) {
  const compact = window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !compact, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, compact ? 1.25 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#afc6ce'); scene.fog = new THREE.Fog('#afc6ce', 110, 470);
  scene.add(new THREE.HemisphereLight('#dceefa', '#435751', 2));
  const sun = new THREE.DirectionalLight('#ffead1', 2.8); sun.position.set(-130, 200, 90); scene.add(sun);
  const landscape = createJourney(scene, compact);
  const camera = new THREE.PerspectiveCamera(compact ? 65 : 57, 1, .2, 1000);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-terrain-chapter]'));
  // Same valley throughout: high establishing shot, meltwater close-up, gorge, forest, open sea.
  const route = [new THREE.Vector3(-42, 155, -90), new THREE.Vector3(riverX(65) + 1, riverLevel(65) + 6, 65), new THREE.Vector3(riverX(205), riverLevel(205) + 12, 205), new THREE.Vector3(riverX(365) - 3, riverLevel(365) + 22, 365), new THREE.Vector3(riverX(570), 25, 570)];
  let target = 0, progress = 0, frame = 0, last = 0, elapsed = 0, lost = false, disposed = false;
  const readScroll = () => {
    target = 4;
    for (let i = 0; i < sections.length - 1; i++) {
      if (window.scrollY < sections[i + 1].offsetTop) {
        target = i + clamp((window.scrollY - sections[i].offsetTop) / (sections[i + 1].offsetTop - sections[i].offsetTop), 0, 1); break;
      }
    }
  };
  const resize = () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); readScroll(); };
  const draw = (now: number) => {
    frame = 0; if (disposed || lost || document.hidden) return;
    const dt = Math.min((now - last) / 1000, .05); last = now;
    progress = reduced.matches ? target : mix(progress, target, 1 - Math.exp(-dt * 4));
    const i = Math.min(3, Math.floor(progress)), t = smooth(0, 1, progress - i);
    camera.position.lerpVectors(route[i], route[i + 1], t);
    const z = camera.position.z;
    // Follow the valley floor so the camera never cuts across a hillside.
    if (progress > 1) camera.position.x = riverX(z) + mix(route[i].x - riverX(route[i].z), route[i + 1].x - riverX(route[i + 1].z), t);
    camera.position.y = Math.max(camera.position.y, height(camera.position.x, z) + 3);
    const ahead = mix(52, 90, smooth(3, 4, progress));
    camera.lookAt(riverX(z + ahead), riverLevel(z + ahead) + mix(8, 16, smooth(3, 4, progress)), z + ahead);
    if (!reduced.matches) elapsed += dt;
    landscape.water.uniforms.time.value = elapsed;
    renderer.render(scene, camera);
    if (!reduced.matches || Math.abs(target - progress) > .001) frame = requestAnimationFrame(draw);
  };
  const wake = () => { if (!frame && !lost && !disposed && !document.hidden) { last = performance.now(); frame = requestAnimationFrame(draw); } };
  const scroll = () => { readScroll(); wake(); };
  const onResize = () => { resize(); wake(); };
  const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; report('三维画面中断，请刷新重试'); };
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake(); };
  resize(); progress = target; wake(); report('三维场景已就绪 · 向下探索');
  window.addEventListener('scroll', scroll, { passive: true }); window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', visibility); reduced.addEventListener('change', wake); canvas.addEventListener('webglcontextlost', contextLost);
  return () => {
    disposed = true; cancelAnimationFrame(frame); window.removeEventListener('scroll', scroll); window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', visibility); reduced.removeEventListener('change', wake); canvas.removeEventListener('webglcontextlost', contextLost);
    landscape.dispose(); renderer.dispose();
  };
}
