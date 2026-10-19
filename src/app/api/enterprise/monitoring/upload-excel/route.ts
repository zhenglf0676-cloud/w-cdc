import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { parseExcelChinaTime } from '@/lib/water-assistant/excel-time';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// 污染物配置：Excel 列名 -> 数据库字段
const POLLUTANT_COLUMNS = [
  { excelName: 'COD',     dbId: 'cod',         unit: 'mg/L',   threshold: 500 },
  { excelName: 'NH3-N',   dbId: 'nh3n',        unit: 'mg/L',   threshold: 0.5 },
  { excelName: 'TP',      dbId: 'tp',          unit: 'mg/L',   threshold: 1.0 },
  { excelName: 'TN',      dbId: 'tn',          unit: 'mg/L',   threshold: 15.0 },
  { excelName: 'pH',      dbId: 'ph',          unit: '无量纲', threshold: 9.0 },
  { excelName: '重金属',  dbId: 'heavy_metal', unit: 'mg/L',   threshold: 0.05 },
];

export async function POST(request: NextRequest) {
  const preview = request.nextUrl.searchParams.get('preview') === '1';
  const strict = request.nextUrl.searchParams.get('strict') === '1';
  
  try {
    // 1. 身份验证
    const authHeader = request.headers.get('x-session');
    
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    let accessToken: string;
    try {
      // 尝试解析为 JSON（兼容旧版本）
      const session = JSON.parse(authHeader);
      accessToken = session.access_token;
    } catch {
      // 如果不是 JSON，直接使用（新版本）
      accessToken = authHeader;
    }

    if (!accessToken) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // 2. 获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      console.error('获取用户信息失败:', userError);
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 3. 获取企业信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('获取企业信息失败:', profileError);
      return NextResponse.json({ error: '企业不存在' }, { status: 404 });
    }
    if (profile.role !== 'enterprise') {
      return NextResponse.json({ error: '只有企业账号可以录入本企业监测数据' }, { status: 403 });
    }

    // 4. 解析 Excel 文件
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }
    if (!/\.xlsx?$/i.test(file.name) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: '仅支持不超过2MB的 .xlsx 或 .xls 文件' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return NextResponse.json({ error: '文件没有可读取的工作表' }, { status: 400 });
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);


    if (jsonData.length === 0) {
      return NextResponse.json({ error: '文件为空' }, { status: 400 });
    }
    if (jsonData.length > 500) {
      return NextResponse.json({ error: '一次最多导入500行，请拆分文件' }, { status: 400 });
    }

    // 5. 验证必需字段
    const firstRow = jsonData[0];
    
    if (!('排污口' in firstRow)) {
      return NextResponse.json({ error: '缺少必需字段：排污口' }, { status: 400 });
    }
    if (!('时间' in firstRow)) {
      return NextResponse.json({ error: '缺少必需字段：时间' }, { status: 400 });
    }

    // 6. 获取企业的排污口列表
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, name')
      .eq('user_id', user.id)
      .eq('status', 'approved');

    if (outletsError) {
      console.error('获取排污口列表失败:', outletsError);
      return NextResponse.json({ error: '获取排污口列表失败' }, { status: 500 });
    }


    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ error: '企业没有已审批通过的排污口' }, { status: 400 });
    }

    const outletMap = new Map(outlets.map(o => [o.name, o.id]));

    // 7. 获取企业已审批通过的污染物列表
    const { data: applications, error: appError } = await supabase
      .from('pollutant_applications')
      .select('pollutants')
      .eq('company_id', profile.id)
      .eq('status', 'approved');

    if (appError) {
      console.error('获取污染物申请失败:', appError);
      return NextResponse.json({ error: '获取污染物申请失败' }, { status: 500 });
    }

    const approvedPollutantIds = new Set<string>();
    const pollutantThresholds = new Map<string, number>(); // 污染物 ID -> 阈值
    if (applications && applications.length > 0) {
      for (const app of applications) {
        const pollutants = app.pollutants as { id: string; threshold?: number | null }[];
        if (Array.isArray(pollutants)) {
          for (const p of pollutants) {
            approvedPollutantIds.add(p.id);
            // 保存阈值，如果没有则使用默认值
            if (p.threshold !== undefined && p.threshold !== null) {
              pollutantThresholds.set(p.id, Number(p.threshold));
            }
          }
        }
      }
    }

    // 8. 解析数据
    const records: { outlet_id: string; pollutant_type: string; value: number; unit: string; standard_limit: number; status: string; monitored_at: string }[] = [];
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

      const monitoredAt = parseExcelChinaTime(timeStr);
      if (!monitoredAt) {
        errors.push(`第${rowNum}行：时间格式错误`);
        continue;
      }

      // 解析污染物数据
      for (const col of POLLUTANT_COLUMNS) {
        const value = row[col.excelName];
        
        // 跳过空值
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // 验证污染物是否已审批通过
        if (!approvedPollutantIds.has(col.dbId)) {
          errors.push(`第${rowNum}行：${col.excelName}未申请或未审批通过`);
          continue;
        }

        const numValue = Number(value);
        if (!Number.isFinite(numValue) || numValue < 0) {
          errors.push(`第${rowNum}行：${col.excelName}数值格式错误`);
          continue;
        }

        // 获取企业特定的阈值，如果没有则使用默认值
        const threshold = pollutantThresholds.has(col.dbId) 
          ? pollutantThresholds.get(col.dbId)! 
          : col.threshold;
        if (!Number.isFinite(threshold)) {
          errors.push(`第${rowNum}行：${col.excelName}审批阈值无效`);
          continue;
        }

        records.push({
          outlet_id: outletMap.get(outletName),
          pollutant_type: col.dbId,
          value: numValue,
          unit: col.unit,
          standard_limit: threshold,
          status: numValue > threshold ? 'warning' : 'normal',
          monitored_at: monitoredAt.toISOString(),
        });
      }
    }


    const seenRecords = new Set<string>();
    for (const record of records) {
      const key = `${record.outlet_id}:${record.pollutant_type}:${record.monitored_at}`;
      if (seenRecords.has(key)) errors.push(`文件内存在重复的排污口、指标和监测时间：${record.pollutant_type} ${record.monitored_at}`);
      seenRecords.add(key);
    }
    const warnings = records.filter(r => r.status === 'warning').map(r => r.pollutant_type);
    if (preview) return NextResponse.json({
      success: records.length > 0 && errors.length === 0,
      preview: true,
      count: records.length,
      errors: errors.slice(0, 20),
      errorCount: errors.length,
      warnings: [...new Set(warnings)],
      approvedOutlets: outlets.map(o => o.name),
      approvedPollutants: POLLUTANT_COLUMNS.filter(c => approvedPollutantIds.has(c.dbId)).map(c => c.excelName),
      sample: records.slice(0, 5).map(r => ({ outlet: outlets.find(o => o.id === r.outlet_id)?.name, time: r.monitored_at, pollutant: r.pollutant_type, value: r.value, unit: r.unit, threshold: r.standard_limit })),
    });
    if (strict && errors.length > 0) return NextResponse.json({ error: `文件有${errors.length}处问题，请修改后重新预检`, errors: errors.slice(0, 20) }, { status: 400 });
    if (records.length === 0) return NextResponse.json({ error: '文件没有可录入的监测数值，请检查已审批指标列' }, { status: 400 });

    // 9. 批量插入数据
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('monitoring_data')
        .insert(records);

      if (insertError) {
        console.error('数据插入失败:', insertError);
        return NextResponse.json({ error: '数据插入失败', details: insertError.message }, { status: 500 });
      }
    }

    // 10. 返回结果
    const result = {
      success: true,
      count: records.length,
      errors: errors.length > 0 ? ['部分数据未上传，请检查 Excel 格式和污染物申请状态', ...errors.slice(0, 20)] : [],
      warnings: [...new Set(warnings)],
    };
    
    
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Excel 上传异常:', error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : undefined);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
