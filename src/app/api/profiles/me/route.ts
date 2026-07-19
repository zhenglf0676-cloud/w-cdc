import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * GET /api/profiles/me
 * 获取当前用户信息
 */
export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();

    // 从请求头获取 token
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 验证用户
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 获取用户 profiles 信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
