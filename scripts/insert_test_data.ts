import { createClient } from '@supabase/supabase-js';

// 直接从环境变量获取配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('Supabase URL:', supabaseUrl);
console.log('Service Role Key:', supabaseKey ? '***' + supabaseKey.slice(-10) : 'NOT SET');

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('开始生成测试数据...');

  // 1. 获取所有已审批的排污口
  const { data: outlets, error: outletsError } = await supabase
    .from('discharge_outlets')
    .select('id, company_id, outlet_name, location')
    .eq('status', 'approved');

  if (outletsError) {
    console.error('获取排污口失败:', outletsError);
    return;
  }

  console.log(`找到 ${outlets.length} 个已审批的排污口`);

  // 2. 获取所有已审批的污染物
  const { data: pollutants, error: pollutantsError } = await supabase
    .from('pollutant_applications')
    .select('id, company_id, pollutant_name, pollutant_type, threshold')
    .eq('status', 'approved');

  if (pollutantsError) {
    console.error('获取污染物失败:', pollutantsError);
    return;
  }

  console.log(`找到 ${pollutants.length} 个已审批的污染物`);

  // 3. 为每个排污口生成 7.18-7.23 的监测数据（每天 3 次）
  const startDate = new Date('2026-07-18T00:00:00Z');
  
  const recordsToInsert = [];
  
  for (const outlet of outlets) {
    // 找到该企业的污染物
    const companyPollutants = pollutants.filter(p => p.company_id === outlet.company_id);
    
    if (companyPollutants.length === 0) {
      console.log(`排污口 ${outlet.outlet_name} 所属企业没有已审批的污染物，跳过`);
      continue;
    }
    
    console.log(`为排污口 ${outlet.outlet_name} 生成数据...`);
    
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
            company_id: outlet.company_id,
            pollutant_name: pollutant.pollutant_name,
            pollutant_type: pollutant.pollutant_type,
            value: value,
            monitored_at: monitoredAt.toISOString(),
            created_at: new Date().toISOString()
          });
        }
      }
    }
  }
  
  console.log(`\n准备插入 ${recordsToInsert.length} 条监测记录...`);
  
  // 4. 批量插入数据
  if (recordsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('monitoring_data')
      .insert(recordsToInsert);
    
    if (insertError) {
      console.error('插入数据失败:', insertError);
      return;
    }
    
    console.log(`✓ 成功插入 ${recordsToInsert.length} 条监测记录`);
  }
  
  // 5. 验证数据
  const { count } = await supabase
    .from('monitoring_data')
    .select('*', { count: 'exact', head: true })
    .gte('monitored_at', '2026-07-18T00:00:00Z')
    .lte('monitored_at', '2026-07-23T23:59:59Z');
  
  console.log(`\n验证：7.18-7.23 期间共有 ${count} 条监测记录`);
}

main().catch(console.error);
