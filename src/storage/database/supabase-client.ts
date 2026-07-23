import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface SupabaseCredentials {
  url: string;
  anonKey: string;
}

function getSupabaseCredentials(): SupabaseCredentials {
  // 支持多种环境变量命名，兼容Vercel和沙箱环境
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.COZE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.COZE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error('Supabase URL is not set. Please set NEXT_PUBLIC_SUPABASE_URL environment variable.');
  }
  if (!anonKey) {
    throw new Error('Supabase anon key is not set. Please set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable.');
  }

  return { url, anonKey };
}

function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY;
}

function getSupabaseClient(token?: string): SupabaseClient {
  const { url, anonKey } = getSupabaseCredentials();

  let key: string;
  if (token) {
    key = anonKey;
  } else {
    const serviceRoleKey = getSupabaseServiceRoleKey();
    key = serviceRoleKey ?? anonKey;
  }

  const globalOptions: Record<string, any> = {};
  if (token) {
    globalOptions.headers = { Authorization: `Bearer ${token}` };
  }

  return createClient(url, key, {
    global: globalOptions,
    db: {
      timeout: 60000,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export { getSupabaseCredentials, getSupabaseServiceRoleKey, getSupabaseClient };
