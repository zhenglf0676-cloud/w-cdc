import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

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
  console.log('=== Excel 上传开始 ===');
  
  try {
    // 1. 身份验证
    const authHeader = request.headers.get('x-session');
    console.log('authHeader:', authHeader ? '存在' : '不存在');
    
    if (!authHeader) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    let session;
    try {
      session = JSON.parse(authHeader);
    } catch {
      return NextResponse.json({ error: '会话格式错误' }, { status: 401 });
    }

    if (!session?.access_token) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. 获取用户信息
    const { data: { user }, error: userError } = await supabase.auth.getUser(session.access_token);
    if (userError || !user) {
      console.error('获取用户信息失败:', userError);
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }
    console.log('用户 ID:', user.id);

    // 3. 获取企业信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('获取企业信息失败:', profileError);
      return NextResponse.json({ error: '企业不存在' }, { status: 404 });
    }
    console.log('企业名称:', profile.full_name, '企业 ID:', profile.id);

    // 4. 解析 Excel 文件
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 });
    }
    console.log('文件名:', file.name, '文件大小:', file.size);

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

    console.log('Excel 行数:', jsonData.length);

    if (jsonData.length === 0) {
      return NextResponse.json({ error: '文件为空' }, { status: 400 });
    }

    // 5. 验证必需字段
    const firstRow = jsonData[0];
    console.log('第一行数据:', firstRow);
    
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

    console.log('排污口数量:', outlets?.length || 0);

    if (!outlets || outlets.length === 0) {
      return NextResponse.json({ error: '企业没有已审批通过的排污口' }, { status: 400 });
    }

    const outletMap = new Map(outlets.map(o => [o.name, o.id]));
    console.log('排污口映射:', Object.fromEntries(outletMap));

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
    console.log('已审批污染物:', Array.from(approvedPollutantIds));

    // 8. 解析数据
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

      let monitoredAt: Date;
      if (typeof timeStr === 'number') {
        // Excel 日期格式
        monitoredAt = new Date((timeStr - 25569) * 86400 * 1000);
      } else {
        monitoredAt = new Date(timeStr);
      }
      
      if (isNaN(monitoredAt.getTime())) {
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
        if (isNaN(numValue)) {
          errors.push(`第${rowNum}行：${col.excelName}数值格式错误`);
          continue;
        }

        records.push({
          outlet_id: outletMap.get(outletName),
          pollutant_type: col.dbId,
          value: numValue,
          unit: col.unit,
          standard_limit: col.threshold,
          status: numValue > col.threshold ? 'warning' : 'normal',
          monitored_at: monitoredAt.toISOString(),
        });
      }
    }

    console.log('解析结果：成功', records.length, '条，错误', errors.length, '条');

    if (errors.length > 0 && records.length === 0) {
      return NextResponse.json({ error: '数据解析失败', details: errors }, { status: 400 });
    }

    // 9. 批量插入数据
    if (records.length > 0) {
      const { error: insertError } = await supabase
        .from('monitoring_data')
        .insert(records);

      if (insertError) {
        console.error('数据插入失败:', insertError);
        return NextResponse.json({ error: '数据插入失败', details: insertError.message }, { status: 500 });
      }
      console.log('数据插入成功');
    }

    // 10. 返回结果
    const warnings = records.filter(r => r.status === 'warning').map(r => r.pollutant_type);
    const result = {
      success: true,
      count: records.length,
      errors: errors.length > 0 ? errors : [],
      warnings: warnings,
    };
    
    console.log('返回结果:', result);
    console.log('=== Excel 上传完成 ===');
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Excel 上传异常:', error);
    console.error('错误堆栈:', error.stack);
    return NextResponse.json({ error: '服务器错误', details: error.message }, { status: 500 });
  }
}
