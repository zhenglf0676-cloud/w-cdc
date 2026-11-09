import type { Metadata } from 'next';
import { TerrainLab } from './terrain-lab';

export const metadata: Metadata = {
  title: '水的旅程 · 山海三维场景试验 | W·CDC',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <TerrainLab />;
}
