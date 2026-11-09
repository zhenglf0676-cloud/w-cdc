import * as THREE from 'three';

const BASE = '/landing/alpine/';
const GRID = 401;
const smooth = THREE.MathUtils.smoothstep;

/** One intentionally composed opening shot, independent of the older journey. */
export async function mountAlpine(canvas: HTMLCanvasElement, signal: AbortSignal, report: (message: string) => void) {
  const mobile = window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let shaderFailed = false;
  renderer.debug.onShaderError = (gl, _program, vertex, fragment) => {
    shaderFailed = true;
    console.error('Alpine shader compilation failed',gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment));
  };
  const owned: Array<{ dispose: () => void }> = [];
  const own = <T extends { dispose: () => void }>(value: T) => { owned.push(value); return value; };
  let frame = 0, disposed = false;
  const cleanResources = () => { if (disposed) return; disposed = true; cancelAnimationFrame(frame); owned.forEach(value => value.dispose()); renderer.dispose(); };
  const loader = new THREE.TextureLoader();
  const texture = async (name: string, color = false) => {
    const tex = await loader.loadAsync(BASE + name);
    if (disposed || signal.aborted) { tex.dispose(); throw new DOMException('Cancelled', 'AbortError'); }
    own(tex); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  try {
    report('正在加载雪岩材质…');
    const [response, rock, rockBump, snowBump] = await Promise.all([
      fetch(BASE + 'massif.u16', { signal }), texture('rock_01_diff.webp', true), texture('rock_01_bump.webp'), texture('snow_02_bump.webp'),
    ]);
    if (!response.ok) throw new Error('Mountain mesh unavailable');
    const bytes = await response.arrayBuffer();
    if (signal.aborted) { cleanResources(); return () => {}; }
    if (bytes.byteLength !== GRID * GRID * 2) throw new Error('Invalid mountain mesh');
    const samples = new Uint16Array(bytes);
    const sampleHeight = (x: number, z: number) => {
      const a = THREE.MathUtils.clamp((x + 700) / 1400 * (GRID - 1), 0, GRID - 1);
      const b = THREE.MathUtils.clamp((z + 650) / 1300 * (GRID - 1), 0, GRID - 1);
      const ix = Math.min(GRID - 2, Math.floor(a)), iz = Math.min(GRID - 2, Math.floor(b));
      const value = THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(samples[iz * GRID + ix], samples[iz * GRID + ix + 1], a - ix),
        THREE.MathUtils.lerp(samples[(iz + 1) * GRID + ix], samples[(iz + 1) * GRID + ix + 1], a - ix), b - iz);
      return value / 65535 * 512;
    };
    const segments = mobile ? 200 : 400;
    const terrain = own(new THREE.PlaneGeometry(1400, 1300, segments, segments));
    terrain.rotateX(-Math.PI / 2);
    const positions = terrain.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setY(i, sampleHeight(positions.getX(i), positions.getZ(i)));
    terrain.computeVertexNormals(); terrain.computeBoundingSphere();
    const material = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .85, bumpMap: rockBump, bumpScale: .55 }));
    material.onBeforeCompile = shader => {
      shader.uniforms.alpineRock = { value: rock };
      shader.uniforms.alpineRockBump = { value: rockBump };
      shader.uniforms.alpineSnowBump = { value: snowBump };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        varying vec3 alpinePosition; varying vec3 alpineNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          alpinePosition = position; alpineNormal = normal;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 alpinePosition; varying vec3 alpineNormal;
        uniform sampler2D alpineRock; uniform sampler2D alpineRockBump; uniform sampler2D alpineSnowBump;
        vec4 alpineTri(sampler2D tex, vec3 p, vec3 weights) {
          return texture2D(tex,p.yz)*weights.x + texture2D(tex,p.xz)*weights.y + texture2D(tex,p.xy)*weights.z;
        }
        float alpineCover(vec3 p, vec3 n, float grain) {
          float altitude = smoothstep(48.,140.,p.y + grain * 25.);
          float slope = smoothstep(.48,.81,n.y + grain * .13);
          float lee = clamp(.86 + n.x*.25, .65, 1.);
          return clamp(altitude * slope * lee,0.,1.);
        }`)
        .replace('#include <map_fragment>', `
          vec3 alpineN = normalize(alpineNormal);
          vec3 alpineWeights = pow(abs(alpineN), vec3(6.));
          alpineWeights /= max(dot(alpineWeights,vec3(1.)),.001);
          vec3 alpineP = alpinePosition;
          vec3 rockColor = alpineTri(alpineRock,alpineP*.027,alpineWeights).rgb;
          float grain = alpineTri(alpineRockBump,alpineP*.019,alpineWeights).r;
          float snowCover = alpineCover(alpineP,alpineN,grain-.5);
          float snowGrain = texture2D(alpineSnowBump,alpineP.xz*.12).r;
          float strata = .90 + .10*sin(alpineP.y*.48 + grain*8. + alpineP.x*.018);
          vec3 stone = rockColor * vec3(.43,.48,.55) * strata;
          vec3 ice = mix(vec3(.64,.77,.83),vec3(.91,.95,.98),snowGrain*.35+.55);
          diffuseColor.rgb *= mix(stone,ice,snowCover);
        `)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(.94,.68,snowCover);`)
        .replace('#include <normal_fragment_maps>', `
          float rockRelief = alpineTri(alpineRockBump,alpineP*.065,alpineWeights).r;
          float microRelief = mix(rockRelief*.75,snowGrain*.16,snowCover);
          vec2 gradient = vec2(dFdx(microRelief), dFdy(microRelief));
          normal = perturbNormalArb(-vViewPosition,normal,gradient,faceDirection);
        `);
    };
    material.customProgramCacheKey = () => 'alpine-triplanar-snow-v1';
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#b1c4d3', .00115);
    const mountain = new THREE.Mesh(terrain, material); mountain.castShadow = true; mountain.receiveShadow = true; scene.add(mountain);
    scene.add(new THREE.HemisphereLight('#b9d8f4', '#40516a', 1.25));
    const sun = new THREE.DirectionalLight('#ffe1b7', 3.1); sun.position.set(-380, 430, 260); sun.target.position.set(40, 100, -100);
    sun.castShadow = true; sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -650, right: 650, top: 650, bottom: -650, near: 1, far: 1800 });
    sun.shadow.bias = -.00015; sun.shadow.normalBias = 1.2; scene.add(sun, sun.target);
    own({ dispose: () => sun.shadow.dispose() });
    const skyMaterial = own(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 direction;void main(){vec3 d=normalize(direction);float t=pow(max(d.y,0.),.6);
        vec3 c=mix(vec3(.65,.75,.83),vec3(.16,.32,.49),t);
        float glow=pow(max(dot(d,normalize(vec3(-.7,.5,.5))),0.),18.);
        c+=vec3(.3,.21,.12)*glow;gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    }));
    const sky = new THREE.Mesh(own(new THREE.SphereGeometry(2500, 24, 16)), skyMaterial); scene.add(sky);
    // A thin, translucent valley layer creates depth without hiding the ridge silhouette.
    const hazeMaterial = own(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 coord;void main(){coord=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec2 coord;void main(){vec2 p=coord*2.-1.;float a=exp(-p.x*p.x*2.-p.y*p.y*6.);
        float wisps=.65+.35*sin(p.x*16.+sin(p.y*12.));gl_FragColor=vec4(.74,.83,.88,a*wisps*.12);}`,
    }));
    for (let i = 0; i < 3; i++) {
      const haze = new THREE.Mesh(own(new THREE.PlaneGeometry(1500, 180)), hazeMaterial);
      haze.position.set(0, 75 + i * 26, -280 - i * 140); scene.add(haze);
    }
    const camera = new THREE.PerspectiveCamera(mobile ? 58 : 43, 1, 1, 4000);
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(-190,195,640),new THREE.Vector3(-105,180,460),new THREE.Vector3(-35,142,270),new THREE.Vector3(-40,95,130)]);
    const aims = new THREE.CatmullRomCurve3([new THREE.Vector3(35,175,-100),new THREE.Vector3(65,195,-120),new THREE.Vector3(45,150,-120),new THREE.Vector3(-35,63,5)]);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let target = 0, progress = 0, lastTime = 0, lost = false;
    const scrollProgress = () => { target = THREE.MathUtils.clamp(window.scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight), 0, 1); };
    const resize = () => { renderer.setSize(window.innerWidth, window.innerHeight, false); camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); scrollProgress(); };
    const aim = new THREE.Vector3();
    const draw = (time: number) => {
      frame = 0; if (disposed || lost || document.hidden) return;
      const dt = Math.min((time - lastTime) / 1000,.05); lastTime = time;
      progress = reduced.matches ? target : THREE.MathUtils.lerp(progress,target,1-Math.exp(-dt*3.5));
      path.getPoint(smooth(progress,0,1),camera.position);
      camera.position.y = Math.max(camera.position.y,sampleHeight(camera.position.x,camera.position.z)+16);
      aims.getPoint(progress,aim); camera.lookAt(aim); sky.position.copy(camera.position);
      renderer.render(scene,camera);
      // Static lighting: render the shadow map once, not on every scroll frame.
      renderer.shadowMap.autoUpdate = false;
      if (Math.abs(target-progress)>.0001) frame=requestAnimationFrame(draw);
    };
    const wake = () => { if (!frame && !disposed && !lost && !document.hidden) {lastTime=performance.now();frame=requestAnimationFrame(draw);} };
    const onScroll = () => {scrollProgress();wake();};
    const onResize = () => {resize();wake();};
    const onVisible = () => {if(document.hidden){cancelAnimationFrame(frame);frame=0;}else wake();};
    const onLost = (event: Event) => {event.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;report('三维画面已中断，请刷新重试');};
    resize();progress=target;
    path.getPoint(progress,camera.position);aims.getPoint(progress,aim);camera.lookAt(aim);
    await renderer.compileAsync(scene,camera);
    if(shaderFailed) throw new Error('Mountain shader compilation failed');
    if(signal.aborted){cleanResources();return () => {};}
    renderer.shadowMap.needsUpdate=true;wake();report('雪山开场已就绪');
    window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onResize);
    document.addEventListener('visibilitychange',onVisible);reduced.addEventListener('change',wake);canvas.addEventListener('webglcontextlost',onLost);
    return () => {
      window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onResize);
      document.removeEventListener('visibilitychange',onVisible);reduced.removeEventListener('change',wake);canvas.removeEventListener('webglcontextlost',onLost);cleanResources();
    };
  } catch(error) {cleanResources();throw error;}
}
