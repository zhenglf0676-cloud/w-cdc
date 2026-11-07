'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const journeyImages = ['snow', 'canyon', 'river', 'soil', 'ocean'].map((name) => `/landing/journey/${name}.webp`);

/** Image-based relief scenery, with a physical 3D water drop. Not a hydrological simulation. */
export function WaterWorld3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.z = 5;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04);
    scene.environment = environment.texture;
    room.dispose();
    pmrem.dispose();
    let disposed = false;
    let ready = false;
    let frame = 0;
    let target = 0;
    let progress = 0;
    let previousTime = 0;
    let pointer = 0;
    let pointerTarget = 0;
    const textures: THREE.Texture[] = [];
    const uniforms = {
      uA: { value: new THREE.Texture() }, uB: { value: new THREE.Texture() },
      uMix: { value: 0 }, uAspect: { value: 1 }, uTravel: { value: 0 }, uPointer: { value: 0 },
    };
    const emptyA = uniforms.uA.value;
    const emptyB = uniforms.uB.value;
    const geometry = new THREE.PlaneGeometry(1, 1, 96, 64);
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec2 vUv;
        void main(){vUv=uv; vec3 p=position;
          float nearField=pow(1.0-uv.y,2.0);
          p.z=nearField*0.35;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `uniform sampler2D uA; uniform sampler2D uB;
        uniform float uMix; uniform float uAspect; uniform float uTravel; uniform float uPointer;
        varying vec2 vUv;
        void main(){
          vec2 cover=vec2(min(1.0,uAspect/(16.0/9.0)),min(1.0,(16.0/9.0)/uAspect));
          vec2 uv=(vUv-.5)*cover/(1.04+uTravel*.018)+.5;
          float depth=pow(1.0-vUv.y,2.0);
          uv.x+=uPointer*(.002+depth*.006);
          uv.y+=uTravel*.008*depth;
          vec4 a=texture2D(uA,uv); vec4 b=texture2D(uB,uv);
          float blend=smoothstep(0.0,1.0,uMix);
          vec3 color=mix(a.rgb,b.rgb,blend);
          float mist=sin(blend*3.14159265)*.12;
          color=mix(color,vec3(.64,.75,.78),mist);
          gl_FragColor=vec4(color,1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const landscape = new THREE.Mesh(geometry, material);
    landscape.position.z = -2;
    scene.add(landscape);
    const profile = [new THREE.Vector2(0,-.36),new THREE.Vector2(.18,-.32),new THREE.Vector2(.27,-.18),new THREE.Vector2(.28,0),new THREE.Vector2(.23,.17),new THREE.Vector2(.12,.38),new THREE.Vector2(0,.64)];
    const smoothProfile = new THREE.SplineCurve(profile).getPoints(48).map((p) => new THREE.Vector2(Math.max(0,p.x),p.y));
    const dropGeometry = new THREE.LatheGeometry(smoothProfile,64);
    const dropMaterial = new THREE.MeshPhysicalMaterial({ color: '#c4f2f5', metalness: 0, roughness: .045, transmission: .97, thickness: .7, ior: 1.333, clearcoat: 1, envMapIntensity: 2 });
    const drop = new THREE.Mesh(dropGeometry,dropMaterial);
    drop.position.z = .6;
    scene.add(drop);
    scene.add(new THREE.HemisphereLight('#eefaff','#294557',2));
    const light = new THREE.DirectionalLight('#ffffff',3);
    light.position.set(-3,5,5);scene.add(light);
    const dropPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.62,.40,.6),new THREE.Vector3(.50,-.02,.6),
      new THREE.Vector3(.65,-.28,.6),new THREE.Vector3(.52,-.38,.6),new THREE.Vector3(.62,-.55,.6),
    ]);
    const ringGeometry = new THREE.RingGeometry(.48,.485,100);
    const ringMaterial = new THREE.MeshBasicMaterial({ color:'#c2edf3', transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false });
    const ring = new THREE.Mesh(ringGeometry,ringMaterial);
    ring.scale.y=.28; ring.position.z=.5;scene.add(ring);
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-stage]'));
    const readScroll = () => {
      const anchors=sections.map((el)=>el.offsetTop);
      const y=window.scrollY;
      target=4;
      for(let i=0;i<anchors.length-1;i++){
        if(y<anchors[i+1]){target=i+THREE.MathUtils.clamp((y-anchors[i])/(anchors[i+1]-anchors[i]),0,1);break;}
      }
    };
    const resize = () => {
      const width=window.innerWidth,height=window.innerHeight;
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
      uniforms.uAspect.value=camera.aspect;
      const h=2*Math.tan(THREE.MathUtils.degToRad(22.5))*7;
      landscape.scale.set(h*camera.aspect*1.1,h*1.1,1);
      readScroll();
    };
    const move=(event:PointerEvent)=>{pointerTarget=(event.clientX/window.innerWidth-.5)*2;};
    const contextLost=(event:Event)=>{event.preventDefault();ready=false;canvas.dataset.ready='false';};
    const render=(time:number)=>{
      if(disposed)return;
      const dt=Math.min((time-previousTime)/1000,.05); previousTime=time;
      const easing=1-Math.exp(-dt*7);
      progress+=(target-progress)*easing;pointer+=(pointerTarget-pointer)*easing;
      if(ready&&!document.hidden){
        const index=Math.min(3,Math.floor(progress));
        uniforms.uA.value=textures[index];uniforms.uB.value=textures[index+1];
        uniforms.uMix.value=THREE.MathUtils.smoothstep(progress-index,.58,1);
        uniforms.uTravel.value=progress-index;uniforms.uPointer.value=pointer;
        const p=dropPath.getPoint(THREE.MathUtils.clamp(progress/4,0,1));
        const visibleHeight=2*Math.tan(THREE.MathUtils.degToRad(22.5))*4.4;
        drop.position.set(p.x*visibleHeight*camera.aspect*.48,p.y*visibleHeight*.5,.6);
        drop.rotation.z=THREE.MathUtils.lerp(-.08,.08,progress/4);
        const vanish=1-THREE.MathUtils.smoothstep(progress,3.65,4);
        const scale=(window.innerWidth<700?.36:.63)*vanish;
        drop.scale.setScalar(scale);
        ring.position.x=drop.position.x;ring.position.y=drop.position.y;
        const arrival=THREE.MathUtils.smoothstep(progress,3.5,4);
        ring.scale.set(1+arrival*1.6,.28+arrival*.4,1);ringMaterial.opacity=arrival*.35;
        renderer.render(scene,camera);
      }
      frame=requestAnimationFrame(render);
    };
    resize();progress=target;
    const loader=new THREE.TextureLoader();
    Promise.all(journeyImages.map((url)=>loader.loadAsync(url).then((texture)=>{
      if(disposed){texture.dispose();return texture;}
      texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);return texture;
    }))).then((ordered)=>{if(!disposed){textures.splice(0,textures.length,...ordered);ready=true;canvas.dataset.ready='true';}}).catch(()=>{canvas.dataset.ready='false';});
    frame=requestAnimationFrame(render);
    window.addEventListener('scroll',readScroll,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pointermove',move,{passive:true});canvas.addEventListener('webglcontextlost',contextLost);
    const preference=()=>{if(reduced.matches){ready=false;canvas.dataset.ready='false';}};
    reduced.addEventListener('change',preference);
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);window.removeEventListener('scroll',readScroll);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',move);canvas.removeEventListener('webglcontextlost',contextLost);reduced.removeEventListener('change',preference);
      textures.forEach((texture)=>texture.dispose());emptyA.dispose();emptyB.dispose();geometry.dispose();material.dispose();dropGeometry.dispose();dropMaterial.dispose();ringGeometry.dispose();ringMaterial.dispose();environment.dispose();renderer.dispose();
    };
  },[]);
  return <canvas ref={canvasRef} className="landing-3d-canvas" aria-hidden="true" />;
}
