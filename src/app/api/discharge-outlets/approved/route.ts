import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const sessionHeader = request.headers.get('x-session');
    if (!sessionHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = sessionHeader;
    const supabase = getSupabaseClient(token);

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
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    // 获取已审批的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (outletsError) {
      console.error('获取排污口错误:', outletsError.message);
      return NextResponse.json({ error: '获取排污口失败' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: outlets || []
    });
  } catch (error: any) {
    console.error('获取排污口数据失败:', error.message);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
