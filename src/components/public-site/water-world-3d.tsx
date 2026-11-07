'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const journeyImages = ['snow', 'canyon', 'river', 'soil', 'ocean'].map((name) => `/landing/journey/${name}.webp`);

/** Image-based relief scenery. The scroll controls one continuous scene timeline. */
export function WaterWorld3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const report = (value: string) => {
      canvas.dataset.status = value;
      window.dispatchEvent(new CustomEvent('landing-renderer', { detail: value }));
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) { report('已启用减少动态效果'); return; }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch { report('WebGL 不可用，正在使用景观动效'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
    camera.position.z = 5;
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
    const contextLost=(event:Event)=>{event.preventDefault();ready=false;canvas.dataset.ready='false';report('WebGL 连接中断，正在使用景观动效');};
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
        renderer.render(scene,camera);
      }
      frame=requestAnimationFrame(render);
    };
    resize();progress=target;
    const loader=new THREE.TextureLoader();
    Promise.all(journeyImages.map((url)=>loader.loadAsync(url).then((texture)=>{
      if(disposed){texture.dispose();return texture;}
      texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);return texture;
    }))).then((ordered)=>{if(!disposed){textures.splice(0,textures.length,...ordered);ready=!reduced.matches;canvas.dataset.ready=String(ready);report(ready?'WebGL 景观已启用':'已启用减少动态效果');}}).catch(()=>{canvas.dataset.ready='false';report('景观素材加载失败，正在使用备用画面');});
    frame=requestAnimationFrame(render);
    window.addEventListener('scroll',readScroll,{passive:true});window.addEventListener('resize',resize);window.addEventListener('pointermove',move,{passive:true});canvas.addEventListener('webglcontextlost',contextLost);
    const preference=()=>{ready=!reduced.matches&&textures.length===journeyImages.length;canvas.dataset.ready=String(ready);report(ready?'WebGL 景观已启用':'已启用减少动态效果');};
    reduced.addEventListener('change',preference);
    return ()=>{
      disposed=true;cancelAnimationFrame(frame);window.removeEventListener('scroll',readScroll);window.removeEventListener('resize',resize);window.removeEventListener('pointermove',move);canvas.removeEventListener('webglcontextlost',contextLost);reduced.removeEventListener('change',preference);
      textures.forEach((texture)=>texture.dispose());emptyA.dispose();emptyB.dispose();geometry.dispose();material.dispose();renderer.dispose();
    };
  },[]);
  return <canvas ref={canvasRef} className="landing-3d-canvas" aria-hidden="true" />;
}
