import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';
export async function GET(request: Request) {
  const token = request.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { url, anonKey } = getSupabaseCredentials();
  const client = getSupabaseClient(token);

  // 获取当前用户
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  // 使用 service role key 绕过 RLS
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const adminClient = createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 获取用户信息
  const { data: profile } = await adminClient.from('profiles').select('*').eq('user_id', user.id).single();

  if (!profile) {
    return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
  }

  // 获取该企业的申请记录
  const { data: applications, error } = await adminClient
    .from('pollutant_applications')
    .select('*')
    .eq('company_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const token = request.headers.get('x-session');
  if (!token) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const { url, anonKey } = getSupabaseCredentials();
  const client = getSupabaseClient(token);

  // 获取当前用户
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '认证失败' }, { status: 401 });
  }

  // 使用 service role key 绕过 RLS
  const serviceRoleKey = getSupabaseServiceRoleKey();
  const adminClient = createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 获取用户信息
  const { data: profile } = await adminClient.from('profiles').select('*').eq('user_id', user.id).single();

  if (!profile) {
    return NextResponse.json({ error: '用户信息不存在' }, { status: 404 });
  }

  const body = await request.json();
  const { pollutants } = body;

  if (!pollutants || !Array.isArray(pollutants) || pollutants.length === 0) {
    return NextResponse.json({ error: '请选择至少一种污染物' }, { status: 400 });
  }

  // 检查是否已申请并通过的污染物
  const { data: approvedApplications } = await adminClient
    .from('pollutant_applications')
    .select('pollutants')
    .eq('company_id', profile.id)
    .eq('status', 'approved');

  if (approvedApplications && approvedApplications.length > 0) {
    // 获取已通过审批的污染物 ID 列表
    const approvedPollutantIds = approvedApplications.flatMap((app: any) =>
      app.pollutants.map((p: any) => p.id || p.name)
    );

    // 检查是否有重复的污染物
    const duplicatePollutants = pollutants.filter((p: any) =>
      approvedPollutantIds.includes(p.id)
    );

    if (duplicatePollutants.length > 0) {
      return NextResponse.json(
        {
          error: `以下污染物已通过审批，不能重复申请：${duplicatePollutants.map((p: any) => p.label || p.id).join('、')}`,
        },
        { status: 400 }
      );
    }
  }

  // 创建申请记录
  const { data, error } = await adminClient
    .from('pollutant_applications')
    .insert({
      company_id: profile.id,
      pollutants: pollutants,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, application: data });
}
