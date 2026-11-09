import type { Metadata } from 'next';
import { TerrainLab } from './terrain-lab';

export const metadata: Metadata = {
  title: '水的旅程 · 真实三维地形试验 | W·CDC',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TerrainLab />;
}
