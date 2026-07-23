import { NextResponse } from 'next/server';
import { getSupabaseCredentials } from '@/storage/database/supabase-client';

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseCredentials();

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: 'Supabase credentials not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json({ url, anonKey });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to get Supabase config:', message);
    return NextResponse.json(
      { error: 'Failed to get Supabase config', details: message },
      { status: 500 }
    );
  }
}
