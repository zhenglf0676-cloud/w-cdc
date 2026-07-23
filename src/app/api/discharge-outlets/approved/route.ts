import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const sessionHeader = request.headers.get('x-session');
    if (!sessionHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const token = sessionHeader;
    // 使用用户token验证身份
    const authClient = getSupabaseClient(token);
    
    let user;
    try {
      const { data: { user: authUser }, error: userError } = await authClient.auth.getUser();
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

    // 使用服务角色密钥查询数据，绕过RLS策略
    const supabase = getSupabaseClient();

    // 获取用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, park_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
    }

    let outlets;
    let outletsError;

    if (profile.role === 'admin') {
      // 管理员：获取园区内所有企业的已审批排污口
      if (!profile.park_name) {
        console.log('管理员没有园区名称');
        return NextResponse.json({
          success: true,
          data: []
        });
      }

      console.log('管理员园区:', profile.park_name);

      // 获取园区内所有企业用户ID
      const { data: enterpriseProfiles } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('park_name', profile.park_name)
        .eq('role', 'enterprise');

      console.log('园区内企业数量:', enterpriseProfiles?.length || 0);

      const enterpriseUserIds = enterpriseProfiles?.map(p => p.user_id) || [];

      if (enterpriseUserIds.length === 0) {
        return NextResponse.json({
          success: true,
          data: []
        });
      }

      // 获取这些企业的所有已审批排污口
      const result = await supabase
        .from('discharge_outlets')
        .select('*')
        .in('user_id', enterpriseUserIds)
        .eq('status', 'approved');
      
      outlets = result.data;
      outletsError = result.error;
    } else {
      // 企业用户：只获取自己的已审批排污口
      const result = await supabase
        .from('discharge_outlets')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'approved');
      
      outlets = result.data;
      outletsError = result.error;
    }

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
