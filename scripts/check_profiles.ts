import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '../src/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

const { url, anonKey } = getSupabaseCredentials();
const serviceRoleKey = getSupabaseServiceRoleKey();
const supabase = createClient(url, serviceRoleKey || anonKey);

async function main() {
  // 检查 profiles 表
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, user_id, company_name');
  
  console.log('Profiles:');
  profiles?.forEach(p => console.log(`  id: ${p.id}, user_id: ${p.user_id}, company: ${p.company_name}`));
}

main();
