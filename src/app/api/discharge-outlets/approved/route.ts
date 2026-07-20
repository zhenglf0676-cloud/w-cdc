import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET /api/discharge-outlets/approved - 获取已审批通过的排污口
// 企业用户：只返回自己的排污口
// 管理员：返回所有排污口
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取 token
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseClient(token);

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '认证失败' },
        { status: 401 }
      );
    }

    // 获取用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, park_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: '用户信息不存在' },
        { status: 400 }
      );
    }

    let query = supabase
      .from('discharge_outlets')
      .select('*')
      .eq('status', 'approved');

    // 企业用户只能看到自己的排污口
    if (profile.role === 'enterprise') {
      query = query.eq('user_id', user.id);
    }
    // 管理员可以看到所有排污口

    const { data: outlets, error } = await query.order('approved_at', { ascending: false });

    if (error) {
      console.error('获取排污口列表失败:', error);
      return NextResponse.json(
        { error: '获取排污口列表失败' },
        { status: 500 }
      );
    }

    // 获取所有用户信息
    const userIds = [...new Set(outlets?.map(o => o.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, company_name')
      .in('user_id', userIds);

    // 关联用户信息
    const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
    const outletsWithProfiles = outlets?.map(o => ({
      ...o,
      profiles: profileMap.get(o.user_id) || null,
    })) || [];

    return NextResponse.json({
      success: true,
      data: outletsWithProfiles
    });
  } catch (error) {
    console.error('获取排污口列表异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
