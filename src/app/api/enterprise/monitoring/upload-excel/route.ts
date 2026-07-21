import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

// 污染物配置
const POLLUTANT_CONFIG: Record<string, { unit: string; threshold: number }> = {
  'COD': { unit: 'mg/L', threshold: 500 },
  'NH3-N': { unit: 'mg/L', threshold: 0.5 },
  'TP': { unit: 'mg/L', threshold: 1.0 },
  'TN': { unit: 'mg/L', threshold: 15.0 },
  'pH': { unit: '无量纲', threshold: 9.0 },
  '重金属': { unit: 'mg/L', threshold: 0.05 },
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-session');
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const session = JSON.parse(authHeader);
    if (!session?.access_token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 获取用户信息
    const { data: { user } } = await supabase.auth.getUser(session.access_token);
    if (!user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 获取企业信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '企业不存在' }, { status: 404 });
    }

    // 解析 Excel 文件
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: '文件为空' }, { status: 400 });
    }

    // 验证必需字段
    const requiredFields = ['排污口', '时间'];
    const firstRow = jsonData[0];
    for (const field of requiredFields) {
      if (!(field in firstRow)) {
        return NextResponse.json({ error: `缺少必需字段：${field}` }, { status: 400 });
      }
    }

    // 获取企业的排污口列表
    const { data: outlets } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ error: '企业没有已审批通过的排污口' }, { status: 400 });
    }

    const outletMap = new Map(outlets.map(o => [o.name, o.id]));

    // 获取企业已审批通过的污染物列表
    const { data: applications } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', profile.id)
      .eq('status', 'approved');

    const approvedPollutantIds = new Set<string>();
    if (applications && applications.length > 0) {
      for (const app of applications) {
        const pollutants = app.pollutants as any[];
        if (Array.isArray(pollutants)) {
          for (const p of pollutants) {
            approvedPollutantIds.add(p.id);
          }
        }
      }
    }

    // 解析数据
    const records: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const rowNum = i + 2; // Excel 行号（从 2 开始，1 是表头）

      // 验证排污口
      const outletName = row['排污口'];
      if (!outletName || !outletMap.has(outletName)) {
        errors.push(`第${rowNum}行：排污口"${outletName}"不属于该企业或不存在`);
        continue;
      }

      // 验证时间
      const timeStr = row['时间'];
      if (!timeStr) {
        errors.push(`第${rowNum}行：缺少时间`);
        continue;
      }

      const monitoredAt = new Date(timeStr);
      if (isNaN(monitoredAt.getTime())) {
        errors.push(`第${rowNum}行：时间格式错误`);
        continue;
      }

      // 解析污染物数据
      for (const [pollutantType, config] of Object.entries(POLLUTANT_CONFIG)) {
        const value = row[pollutantType];
        if (value !== undefined && value !== null && value !== '') {
          // 验证污染物是否已审批通过
          if (!approvedPollutantIds.has(pollutantType.toLowerCase())) {
            errors.push(`第${rowNum}行：${pollutantType}未申请或未审批通过`);
            continue;
          }

          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`第${rowNum}行：${pollutantType}数值格式错误`);
            continue;
          }

          records.push({
            outlet_id: outletMap.get(outletName),
            pollutant_type: pollutantType.toLowerCase(),
            value: numValue,
            unit: config.unit,
            standard_limit: config.threshold,
            status: numValue > config.threshold ? 'warning' : 'normal',
            monitored_at: monitoredAt.toISOString(),
          });
        }
      }
    }

    if (errors.length > 0 && records.length === 0) {
      return NextResponse.json({ error: '数据解析失败', details: errors }, { status: 400 });
    }

    // 批量插入数据
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('monitoring_data')
        .insert(records);

      if (insertError) {
        return NextResponse.json({ error: '数据插入失败', details: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      count: records.length,
      errors: errors.length > 0 ? errors : undefined,
      warnings: records.filter(r => r.status === 'warning').map(r => r.pollutant_type),
    });
  } catch (error: any) {
    console.error('Excel 上传异常:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
