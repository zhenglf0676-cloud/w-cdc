import { NextRequest, NextResponse } from 'next/server';
import { requireParkAdmin } from '@/lib/admin-authorization';

export async function GET(request: NextRequest) {
  try {
    const access = await requireParkAdmin(request);
    if (!access.ok) return access.response;
    const { db, parkName } = access.context;

    const { data: companies, error: companyError } = await db.from('profiles')
      .select('id').eq('role', 'enterprise').eq('park_name', parkName);
    if (companyError) throw companyError;
    const companyIds = (companies ?? []).map(company => company.id);
    if (!companyIds.length) return NextResponse.json({ count: 0 });

    const { count, error } = await db
      .from('pollutant_applications')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .in('company_id', companyIds);

    if (error) {
      console.error('获取待审批数量失败:', error);
      return NextResponse.json({ error: '获取失败' }, { status: 500 });
    }

    return NextResponse.json({ count: count || 0 });
  } catch (error) {
    console.error('获取待审批数量异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
