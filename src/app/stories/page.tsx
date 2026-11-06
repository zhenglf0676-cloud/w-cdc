import type { Metadata } from 'next';
import { StoriesExperience } from '@/components/public-site/stories-experience';

export const metadata: Metadata = {
  title: '治理案例 · 地下水保护',
  description: '通过中国地下水保护案例，了解源头预防、污染溯源与长期修复的重要性。',
};

export default function StoriesPage() {
  return <StoriesExperience />;
}
