import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const sessionHeader = request.headers.get('x-session');
    if (!sessionHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = sessionHeader;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = getSupabaseServiceRoleKey();

    if (!supabaseServiceKey) {
      return NextResponse.json({ error: '服务配置错误' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    let user;
    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('getUser 错误:', userError.message);
        return NextResponse.json({ error: '认证失败' }, { status: 401 });
      }
      user = authUser;
    } catch (error: any) {
      console.error('getUser 异常:', error.message);
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    if (!user) {
      console.error('用户不存在');
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 获取用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // 根据角色查询排污口
    let outlets;
    if (profile.role === 'admin') {
      // 管理员获取所有已审批通过的排污口
      const { data, error } = await supabase
        .from('discharge_outlets')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查询排污口失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      outlets = data || [];
    } else {
      // 企业用户获取自己的已审批通过的排污口
      const { data, error } = await supabase
        .from('discharge_outlets')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('查询排污口失败:', error);
        return NextResponse.json({ error: '查询失败' }, { status: 500 });
      }

      outlets = data || [];
    }

    return NextResponse.json(outlets);
  } catch (error) {
    console.error('获取已审批通过的排污口异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
