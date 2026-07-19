import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { profiles } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/admin/park-enterprises
 * 获取当前管理员园区下的所有企业
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

    // 获取当前用户的 profiles 信息
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (profileError || !adminProfile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    if (adminProfile.role !== 'admin') {
      return NextResponse.json({ error: '无权限访问' }, { status: 403 });
    }

    // 查询该园区下的所有企业
    const { data: enterprises, error: queryError } = await supabase
      .from('profiles')
      .select('*')
      .eq('park_name', adminProfile.full_name)
      .eq('role', 'enterprise');

    if (queryError) {
      throw queryError;
    }

    return NextResponse.json({
      success: true,
      data: {
        parkName: adminProfile.full_name,
        enterprises: enterprises || [],
      },
    });
  } catch (error) {
    console.error('获取园区企业失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
