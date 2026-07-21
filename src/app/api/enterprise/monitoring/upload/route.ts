import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient } from '@/storage/database/supabase-client';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST /api/enterprise/monitoring/upload - 企业上传监测数据
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const client = getSupabaseClient(token);
    const { data: { user }, error: authError } = await client.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { outletId, monitoredAt, values, remark } = body;

    if (!outletId || !monitoredAt || !values || typeof values !== 'object') {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 解析时间：确保作为中国本地时间（CST，UTC+8）处理
    let monitoredAtDate: Date;
    if (typeof monitoredAt === 'string' && monitoredAt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
      // 格式：YYYY-MM-DDTHH:mm，作为中国本地时间处理
      const [datePart, timePart] = monitoredAt.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      monitoredAtDate = new Date(Date.UTC(year, month - 1, day, hour - 8, minute));
    } else {
      monitoredAtDate = new Date(monitoredAt);
    }

    // 验证排污口是否属于当前企业
    const { data: outlet } = await supabase
      .from('discharge_outlets')
      .select('id, status')
      .eq('id', outletId)
      .eq('user_id', user.id)
      .single();

    if (!outlet) {
      return NextResponse.json(
        { error: '排污口不存在或不属于当前企业' },
        { status: 404 }
      );
    }

    if (outlet.status !== 'approved') {
      return NextResponse.json(
        { error: '只能为已审批通过的排污口上传数据' },
        { status: 400 }
      );
    }

    // 获取企业审批通过的污染物
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: '用户信息不存在' },
        { status: 404 }
      );
    }

    const { data: applications } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', profile.id)
      .eq('status', 'approved');

    // 合并所有已审批的污染物
    const approvedPollutants: Record<string, { label: string; unit: string; threshold: number }> = {};
    if (applications && Array.isArray(applications)) {
      applications.forEach((app: any) => {
        if (app.pollutants && Array.isArray(app.pollutants)) {
          app.pollutants.forEach((p: any) => {
            if (!approvedPollutants[p.id]) {
              approvedPollutants[p.id] = {
                label: p.label,
                unit: p.unit,
                threshold: p.threshold,
              };
            }
          });
        }
      });
    }

    // 验证并插入数据
    const recordsToInsert = [];
    const warnings: string[] = [];

    for (const [pollutantId, value] of Object.entries(values)) {
      const pollutant = approvedPollutants[pollutantId];
      if (!pollutant) {
        continue; // 跳过未审批的污染物
      }

      const numValue = Number(value);
      if (isNaN(numValue)) {
        continue;
      }

      const status = numValue > pollutant.threshold ? 'warning' : 'normal';
      if (status === 'warning') {
        warnings.push(pollutant.label);
      }

      recordsToInsert.push({
        outlet_id: outletId,
        pollutant_type: pollutantId,
        value: numValue,
        unit: pollutant.unit,
        standard_limit: pollutant.threshold,
        status,
        monitored_at: monitoredAtDate,
        remark: remark || null,
      });
    }

    if (recordsToInsert.length === 0) {
      return NextResponse.json(
        { error: '没有有效的数据' },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from('monitoring_data')
      .insert(recordsToInsert);

    if (insertError) {
      console.error('插入监测数据失败:', insertError);
      return NextResponse.json(
        { error: '保存数据失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: recordsToInsert.length,
      warnings,
    });
  } catch (error) {
    console.error('上传监测数据异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
