'use client';

import { useEffect, useState } from 'react';

/** Decorative film for the public pages; the poster remains visible without motion. */
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
      {motionEnabled && <video autoPlay muted loop playsInline preload="metadata" poster="/water-dream-poster.webp"><source src="/water-dream.mp4" type="video/mp4" /></video>}
      <span className="public-water-grain" />
      <span className="public-water-light" />
    </div>
  );
}
