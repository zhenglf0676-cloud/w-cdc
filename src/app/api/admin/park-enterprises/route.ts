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
    // 从请求头获取 token
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 使用用户token验证用户身份
    const authClient = getSupabaseClient(token);
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    // 使用服务角色密钥查询数据，绕过RLS策略
    const supabase = getSupabaseClient();

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
      .eq('park_name', adminProfile.park_name)
      .eq('role', 'enterprise');

    if (queryError) {
      throw queryError;
    }

    // 为每个企业计算已审批通过的排污口数量
    const enterprisesWithOutletCount = await Promise.all(
      (enterprises || []).map(async (enterprise) => {
        const { count, error: countError } = await supabase
          .from('discharge_outlets')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', enterprise.user_id)
          .eq('status', 'approved');

        if (countError) {
          console.error(`获取企业 ${enterprise.company_name} 的排污口数量失败:`, countError);
          return { ...enterprise, outlet_count: 0 };
        }

        return { ...enterprise, outlet_count: count || 0 };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        parkName: adminProfile.park_name,
        enterprises: enterprisesWithOutletCount,
      },
    });
  } catch (error) {
    console.error('获取园区企业失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
