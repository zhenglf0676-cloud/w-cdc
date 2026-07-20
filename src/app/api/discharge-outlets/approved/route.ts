import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 使用 service role key 创建 Supabase 客户端（绕过 RLS）
    const serviceRoleKey = getSupabaseServiceRoleKey();
    const supabase = getSupabaseClient(serviceRoleKey);

    // 验证用户身份
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 检查用户角色
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // 获取所有已审批通过的排污口
    const { data: outlets, error } = await supabase
      .from('discharge_outlets')
      .select('*')
      .eq('status', 'approved');

    if (error) {
      return NextResponse.json({ error: '获取排污口数据失败' }, { status: 500 });
    }

    // 获取所有企业的完整信息
    const userIds = [...new Set(outlets?.map((o: { user_id: string }) => o.user_id) || [])];
    let profiles: { id: string; full_name: string; company_name: string }[] = [];
    if (userIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, company_name')
        .in('id', userIds);
      profiles = profileData || [];
    }

    // 关联企业信息
    const outletsWithProfiles = outlets?.map((o: { user_id: string }) => {
      const profile = profiles.find((p: { id: string }) => p.id === o.user_id);
      return {
        ...o,
        full_name: profile?.full_name || '',
        company_name: profile?.company_name || '',
      };
    }) || [];

    return NextResponse.json(outletsWithProfiles);
  } catch (error) {
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
