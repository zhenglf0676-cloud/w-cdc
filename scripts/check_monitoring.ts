import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '../src/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

const { url, anonKey } = getSupabaseCredentials();
const serviceRoleKey = getSupabaseServiceRoleKey();
const supabase = createClient(url, serviceRoleKey || anonKey);

async function main() {
  const { data } = await supabase
    .from('monitoring_data')
    .select('*')
    .limit(1);
  
  console.log('monitoring_data columns:', data && data[0] ? Object.keys(data[0]) : []);
}

main();
