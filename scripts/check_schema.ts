import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '../src/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

const { url, anonKey } = getSupabaseCredentials();
const serviceRoleKey = getSupabaseServiceRoleKey();
const supabase = createClient(url, serviceRoleKey || anonKey);

async function main() {
  // 检查 discharge_outlets 表结构
  const { data: outlets, error } = await supabase
    .from('discharge_outlets')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('discharge_outlets columns:', outlets && outlets[0] ? Object.keys(outlets[0]) : []);
  }

  // 检查 pollutant_applications 表结构
  const { data: pollutants, error: pError } = await supabase
    .from('pollutant_applications')
    .select('*')
    .limit(1);
  
  if (pError) {
    console.error('Error:', pError);
  } else {
    console.log('pollutant_applications columns:', pollutants && pollutants[0] ? Object.keys(pollutants[0]) : []);
  }
}

main();
