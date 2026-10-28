import { NextResponse } from 'next/server';
import { requireParkAdmin } from '@/lib/admin-authorization';

export async function GET(request: Request) {
  try {
    const access = await requireParkAdmin(request);
    if (!access.ok) return access.response;
    const { db, parkName } = access.context;
    const { data: companies, error: companyError } = await db.from('profiles')
      .select('id').eq('role', 'enterprise').eq('park_name', parkName);
    if (companyError) throw companyError;
    const companyIds = (companies ?? []).map(company => company.id);
    if (!companyIds.length) return NextResponse.json({ pending: [], approved: [] });

    // 获取所有待审批的申请
    const { data: pendingApplications, error } = await db
      .from('pollutant_applications')
      .select(`
        *,
        profiles!company_id(full_name, company_name, park_name)
      `)
      .eq('status', 'pending')
      .in('company_id', companyIds)
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
      .in('company_id', companyIds)
      .order('approved_at', { ascending: false });

    // 处理数据，将 profiles 展平到顶层
    type ApplicationRow = {
      profiles?: { company_name?: string | null; full_name?: string | null; park_name?: string | null } | null;
      [key: string]: unknown;
    };
    const processApplications = (apps: ApplicationRow[]) => {
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
