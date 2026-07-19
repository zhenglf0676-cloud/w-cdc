import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, role, fullName, companyName, parkName, latitude, longitude } = body;

    if (!userId || !role || !fullName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // Check if profile already exists
    const { data: existing } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, message: 'Profile already exists' });
    }

    const { error } = await client.from('profiles').insert({
      user_id: userId,
      role,
      full_name: fullName,
      company_name: companyName || null,
      park_name: parkName || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    });

    if (error) {
      throw new Error(`Failed to create profile: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to create profile:', error);
    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}
