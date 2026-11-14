'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { chapterHeights, chapterPositions, createLandscape, streamX } from './landscape-geometry';

/** A continuous landscape and one camera flight, controlled by scrolling. */
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
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch { report('WebGL 不可用，正在使用景观画面'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.32;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a8bec2');
    scene.fog = new THREE.Fog('#a8bec2', 46, 135);
    scene.add(new THREE.HemisphereLight('#e4f2f3', '#405558', 2.3));
    const sun = new THREE.DirectionalLight('#ffe6c5', 2.1);
    sun.position.set(-36, 61, -87);
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(65, 1, .1, 180);
    const landscape = createLandscape(scene);
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-landing-stage]'));
    let disposed = false, frame = 0, target = 0, progress = 0, pointer = 0, pointerTarget = 0, lastTime = 0, ready = true;
    const readScroll = () => {
      const y = window.scrollY;
      target = 4;
      for (let i = 0; i < sections.length - 1; i++) {
        if (y < sections[i + 1].offsetTop) {
          target = i + Math.max(0, Math.min(1, (y - sections[i].offsetTop) / (sections[i + 1].offsetTop - sections[i].offsetTop)));
          break;
        }
      }
    };
    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      readScroll();
    };
    const move = (event: PointerEvent) => { pointerTarget = (event.clientX / window.innerWidth - .5) * 2; };
    const render = (time: number) => {
      if (disposed) return;
      const dt = Math.min((time - lastTime) / 1000, .05);
      lastTime = time;
      const easing = 1 - Math.exp(-dt * 2.8);
      progress += (target - progress) * easing;
      pointer += (pointerTarget - pointer) * easing;
      if (ready && !document.hidden) {
        const index = Math.min(3, Math.floor(progress));
        const fraction = progress - index;
        const z = THREE.MathUtils.lerp(chapterPositions[index], chapterPositions[index + 1], fraction);
        const height = THREE.MathUtils.lerp(chapterHeights[index], chapterHeights[index + 1], fraction);
        camera.position.set(streamX(z) + pointer * 1.8, height, z);
        camera.lookAt(streamX(z - 33) + pointer * .7, Math.max(1, height * .35), z - 33);
        landscape.waterMaterial.uniforms.uTime.value = time / 1000;
        renderer.render(scene, camera);
      }
      frame = requestAnimationFrame(render);
    };
    resize(); progress = target;
    frame = requestAnimationFrame(render);
    canvas.dataset.ready = 'true';
    report('WebGL 三维地形已启用');
    window.addEventListener('scroll', readScroll, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', move, { passive: true });
    const contextLost = (event: Event) => { event.preventDefault(); ready = false; canvas.dataset.ready = 'false'; report('WebGL 连接中断，正在使用景观画面'); };
    canvas.addEventListener('webglcontextlost', contextLost);
    const preference = () => { ready = !reduced.matches; canvas.dataset.ready = String(ready); report(ready ? 'WebGL 三维地形已启用' : '已启用减少动态效果'); };
    reduced.addEventListener('change', preference);
    return () => {
      disposed = true; cancelAnimationFrame(frame);
      window.removeEventListener('scroll', readScroll);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      canvas.removeEventListener('webglcontextlost', contextLost);
      reduced.removeEventListener('change', preference);
      landscape.dispose();
      renderer.dispose();
    };
  }, []);
  return <canvas ref={canvasRef} className="landing-3d-canvas" aria-hidden="true" />;
}
