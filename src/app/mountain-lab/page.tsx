import type { Metadata } from 'next';
import { AlpineOpening } from './alpine-opening';
export const metadata: Metadata = { title: '雪山开场 · W·CDC', robots: { index: false, follow: false } };
export default function Page() { return <AlpineOpening />; }
