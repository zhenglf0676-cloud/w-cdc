import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

export async function POST(request: NextRequest) {
  try {
    if (!getSupabaseServiceRoleKey()) {
      return NextResponse.json({ error: '服务端权限未配置' }, { status: 503 });
    }

    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const client = getSupabaseClient();
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: '登录已失效' }, { status: 401 });

    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '企业资料格式错误' }, { status: 400 });
    }
    const { userId, role, fullName, companyName, parkName, latitude, longitude } = body as Record<string, unknown>;
    if (role !== 'enterprise' || (userId && userId !== user.id)) {
      return NextResponse.json({ error: '无权指定账号或管理员角色' }, { status: 403 });
    }
    if (typeof fullName !== 'string' || !fullName.trim() ||
        typeof companyName !== 'string' || !companyName.trim() ||
        typeof parkName !== 'string' || !parkName.trim() ||
        typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
        typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: '企业资料不完整' }, { status: 400 });
    }

    // Check if profile already exists
    const { data: existing } = await client
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, message: 'Profile already exists' });
    }

    const { error } = await client.from('profiles').insert({
      user_id: user.id,
      role: 'enterprise',
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      park_name: parkName.trim(),
      latitude,
      longitude,
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
