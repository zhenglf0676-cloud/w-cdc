import { NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { url } = getSupabaseCredentials();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    const db = createClient(url, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 验证管理员身份
    const {
      data: { user },
    } = await db.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { data: adminProfile } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // 获取所有待审批的申请
    const { data: pendingApplications, error } = await db
      .from('pollutant_applications')
      .select(`
        *,
        profiles!company_id(full_name, company_name, park_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('查询申请失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    // 获取已审批的申请
    const { data: approvedApplications } = await db
      .from('pollutant_applications')
      .select(`
        *,
        profiles!company_id(full_name, company_name, park_name)
      `)
      .in('status', ['approved', 'rejected'])
      .order('approved_at', { ascending: false });

    // 处理数据，将 profiles 展平到顶层
    const processApplications = (apps: any[]) => {
      return apps.map(app => ({
        ...app,
        company_name: app.profiles?.company_name || app.profiles?.full_name || '未知企业',
        park_name: app.profiles?.park_name || '',
        full_name: app.profiles?.full_name || '',
      }));
    };

    return NextResponse.json({
      pending: processApplications(pendingApplications || []),
      approved: processApplications(approvedApplications || []),
    });
  } catch (error) {
    console.error('获取申请列表失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
