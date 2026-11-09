// Standalone ES module: keeps the optional 3D terrain experiment out of the
// main application's JS bundle and leaves the existing landing page intact.
import Map from 'https://js.arcgis.com/4.34/@arcgis/core/Map.js';
import SceneView from 'https://js.arcgis.com/4.34/@arcgis/core/views/SceneView.js';
import Basemap from 'https://js.arcgis.com/4.34/@arcgis/core/Basemap.js';
import TileLayer from 'https://js.arcgis.com/4.34/@arcgis/core/layers/TileLayer.js';
import ElevationLayer from 'https://js.arcgis.com/4.34/@arcgis/core/layers/ElevationLayer.js';
import Ground from 'https://js.arcgis.com/4.34/@arcgis/core/Ground.js';

const notify = (message) => window.dispatchEvent(new CustomEvent('wcdc-terrain-status', { detail: message }));
const container = document.getElementById('terrain-lab-view');
if (!container) throw new Error('Terrain container missing');

// A single route from the New Zealand Southern Alps via the Waiho valley to
// the Tasman Sea. Satellite imagery is draped on a real elevation surface.
const waypoints = [
  { longitude:170.135, latitude:-43.535, z:7600, heading:244, tilt:73 },
  { longitude:170.055, latitude:-43.465, z:3600, heading:261, tilt:76 },
  { longitude:169.995, latitude:-43.435, z:1950, heading:274, tilt:78 },
  { longitude:169.885, latitude:-43.405, z:1850, heading:281, tilt:72 },
  { longitude:169.775, latitude:-43.395, z:3700, heading:282, tilt:69 },
];

let view;
let frame = 0;
let actual = 0;
let target = 0;
let stopped = false;
const map = new Map({
  basemap:new Basemap({ baseLayers:[new TileLayer({ url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer' })] }),
  ground:new Ground({ layers:[new ElevationLayer({ url:'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer' })] }),
});
try {
  view = new SceneView({
    container, map, camera:{ position:waypoints[0], heading:waypoints[0].heading, tilt:waypoints[0].tilt },
    qualityProfile:'high',
    environment:{ atmosphereEnabled:true, starsEnabled:false, lighting:{ directShadowsEnabled:true, date:new Date('2026-01-28T23:30:00Z') } },
  });
  await view.when();
  if (!stopped) notify('真实三维地形已加载 · 向下滚动移动镜头');
} catch (error) {
  console.error('Terrain experiment failed', error);
  notify('地形服务或 WebGL 不可用，请检查网络后刷新');
  throw error;
}

const chapters = [...document.querySelectorAll('[data-terrain-chapter]')];
const smoothstep = (t) => t * t * (3 - 2 * t);
const lerp = (a,b,t) => a + (b-a)*t;
function readScroll() {
  const top = window.scrollY;
  target = chapters.length - 1;
  for (let index=0; index<chapters.length-1; index++) {
    const next = chapters[index+1].offsetTop;
    if (top < next) {
      target = index + Math.max(0,Math.min(1,(top-chapters[index].offsetTop)/(next-chapters[index].offsetTop)));
      break;
    }
  }
}
function draw() {
  if (stopped) return;
  actual += (target-actual) * .055;
  if (Math.abs(target-actual) > .0002) {
    const chapter = Math.min(waypoints.length-2,Math.floor(actual));
    const blend = smoothstep(actual-chapter);
    const start = waypoints[chapter];
    const end = waypoints[chapter+1];
    const position = {
      longitude:lerp(start.longitude,end.longitude,blend),
      latitude:lerp(start.latitude,end.latitude,blend),
      z:lerp(start.z,end.z,blend),
    };
    const camera = view.camera.clone();
    camera.position = position;
    camera.heading = lerp(start.heading,end.heading,blend);
    camera.tilt = lerp(start.tilt,end.tilt,blend);
    view.camera = camera;
  }
  frame = requestAnimationFrame(draw);
}
readScroll();
window.addEventListener('scroll',readScroll,{passive:true});
frame=requestAnimationFrame(draw);
window.addEventListener('wcdc-terrain-dispose', () => {
  stopped=true;
  cancelAnimationFrame(frame);
  window.removeEventListener('scroll',readScroll);
  view.destroy();
}, { once:true });
