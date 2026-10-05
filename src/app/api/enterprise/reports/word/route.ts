import { wordResponse } from '@/lib/water-reports/handler';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) { return wordResponse(request, 'enterprise'); }
