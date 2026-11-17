'use client';

import { useEffect, useState } from 'react';

/** Decorative underwater film; the poster remains visible without motion. */
export function PublicWaterScene() {
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionEnabled(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  return (
    <div className="public-water-scene" aria-hidden="true">
      {motionEnabled && <video autoPlay muted loop playsInline preload="metadata" poster="/visuals/sea-underwater.webp"><source src="/visuals/sea-underwater-loop.mp4" type="video/mp4" /></video>}
      <span className="public-water-grain" />
    </div>
  );
}
