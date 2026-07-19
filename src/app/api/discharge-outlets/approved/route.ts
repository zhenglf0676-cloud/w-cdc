import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET /api/discharge-outlets/approved - 获取已审批通过的排污口
// 企业用户：只返回自己的排污口
// 管理员：返回所有排污口
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '未登录' },
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
      .select(`
        *,
        profiles:user_id (full_name, company_name)
      `)
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

    return NextResponse.json({
      success: true,
      data: outlets || []
    });
  } catch (error) {
    console.error('获取排污口列表异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
