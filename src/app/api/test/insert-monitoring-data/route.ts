import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { url, anonKey } = getSupabaseCredentials();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    
    if (!url || !serviceRoleKey) {
      return NextResponse.json({ error: 'Supabase 配置缺失' }, { status: 500 });
    }

    const supabase = createClient(url, serviceRoleKey || anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('开始生成测试数据...');

    // 1. 获取所有已审批的排污口
    const { data: outlets, error: outletsError } = await supabase
      .from('discharge_outlets')
      .select('id, user_id, name, latitude, longitude')
      .eq('status', 'approved');

    if (outletsError) {
      console.error('获取排污口失败:', outletsError);
      return NextResponse.json({ error: '获取排污口失败' }, { status: 500 });
    }

    console.log(`找到 ${outlets.length} 个已审批的排污口`);

    // 1.5 获取 profiles 表，建立 user_id 到 company_id 的映射
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id');

    if (profilesError) {
      console.error('获取 profiles 失败:', profilesError);
      return NextResponse.json({ error: '获取 profiles 失败' }, { status: 500 });
    }

    // 创建 user_id -> company_id 的映射
    const userIdToCompanyId = new Map<string, string>();
    profiles?.forEach(p => {
      if (p.user_id && p.id) {
        userIdToCompanyId.set(p.user_id, p.id);
      }
    });

    console.log(`建立 ${userIdToCompanyId.size} 个 user_id -> company_id 映射`);

    // 2. 获取所有已审批的污染物申请
    const { data: applications, error: applicationsError } = await supabase
      .from('pollutant_applications')
      .select('id, company_id, pollutants, status')
      .eq('status', 'approved');

    if (applicationsError) {
      console.error('获取污染物申请失败:', applicationsError);
      return NextResponse.json({ error: '获取污染物申请失败' }, { status: 500 });
    }

    console.log(`找到 ${applications.length} 个已审批的污染物申请`);

    // 解析污染物列表
    const allPollutants: Array<{
      company_id: string;
      pollutant_name: string;
      pollutant_type: string;
      threshold: string;
    }> = [];

    for (const app of applications) {
      const pollutants = typeof app.pollutants === 'string' 
        ? JSON.parse(app.pollutants) 
        : app.pollutants;
      
      if (Array.isArray(pollutants)) {
        for (const p of pollutants) {
          allPollutants.push({
            company_id: app.company_id,
            pollutant_name: p.name || p.pollutant_name,
            pollutant_type: p.type || p.pollutant_type || 'general',
            threshold: p.threshold || '1.0'
          });
        }
      }
    }

    console.log(`解析出 ${allPollutants.length} 个污染物`);

    // 3. 为每个排污口生成 7.18-7.23 的监测数据（每天 3 次）
    const startDate = new Date('2026-07-18T00:00:00Z');
    
    const recordsToInsert = [];
    
    for (const outlet of outlets) {
      // 通过 user_id 找到 company_id
      const companyId = userIdToCompanyId.get(outlet.user_id);
      
      if (!companyId) {
        console.log(`排污口 ${outlet.name} 未找到对应的 company_id，跳过`);
        continue;
      }
      
      // 找到该企业的污染物（使用 company_id 匹配）
      const companyPollutants = allPollutants.filter(p => p.company_id === companyId);
      
      if (companyPollutants.length === 0) {
        console.log(`排污口 ${outlet.name} 所属企业没有已审批的污染物，跳过`);
        continue;
      }
      
      console.log(`为排污口 ${outlet.name} 生成数据...`);
      
      // 生成 7.18-7.23 每天 3 次监测数据（8:00, 14:00, 20:00）
      for (let day = 0; day < 6; day++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + day);
        
        const times = [8, 14, 20];
        for (const hour of times) {
          const monitoredAt = new Date(currentDate);
          monitoredAt.setHours(hour, 0, 0, 0);
          
          for (const pollutant of companyPollutants) {
            // 根据污染物类型生成合理的监测值
            const threshold = parseFloat(pollutant.threshold) || 1.0;
            
            // 生成 0.3-1.5 倍阈值之间的随机值
            const randomFactor = 0.3 + Math.random() * 1.2;
            const value = parseFloat((threshold * randomFactor).toFixed(4));
            
            recordsToInsert.push({
              outlet_id: outlet.id,
              pollutant_type: pollutant.pollutant_type,
              value: value,
              unit: 'mg/L',
              standard_limit: threshold,
              status: 'normal',
              monitored_at: monitoredAt.toISOString(),
              created_at: new Date().toISOString()
            });
          }
        }
      }
    }
    
    console.log(`准备插入 ${recordsToInsert.length} 条监测记录...`);
    
    // 4. 批量插入数据
    if (recordsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('monitoring_data')
        .insert(recordsToInsert);
      
      if (insertError) {
        console.error('插入数据失败:', insertError);
        return NextResponse.json({ error: '插入数据失败' }, { status: 500 });
      }
      
      console.log(`✓ 成功插入 ${recordsToInsert.length} 条监测记录`);
    }
    
    // 5. 验证数据
    const { count } = await supabase
      .from('monitoring_data')
      .select('*', { count: 'exact', head: true })
      .gte('monitored_at', '2026-07-18T00:00:00Z')
      .lte('monitored_at', '2026-07-23T23:59:59Z');
    
    console.log(`验证：7.18-7.23 期间共有 ${count} 条监测记录`);

    return NextResponse.json({
      success: true,
      message: `成功生成 ${recordsToInsert.length} 条测试数据`,
      count: recordsToInsert.length
    });

  } catch (error) {
    console.error('生成测试数据失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
