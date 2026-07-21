import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '../src/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

const { url, anonKey } = getSupabaseCredentials();
const serviceRoleKey = getSupabaseServiceRoleKey();
const supabase = createClient(url, serviceRoleKey || anonKey);

async function main() {
  // 检查排污口的 user_id
  const { data: outlets } = await supabase
    .from('discharge_outlets')
    .select('id, user_id, name')
    .eq('status', 'approved');
  
  console.log('排污口 user_id:');
  outlets?.forEach(o => console.log(`  ${o.name}: ${o.user_id}`));

  // 检查污染物申请的 company_id
  const { data: applications } = await supabase
    .from('pollutant_applications')
    .select('id, company_id')
    .eq('status', 'approved');
  
  console.log('\n污染物申请 company_id:');
  applications?.forEach(a => console.log(`  ${a.id}: ${a.company_id}`));
}

main();
