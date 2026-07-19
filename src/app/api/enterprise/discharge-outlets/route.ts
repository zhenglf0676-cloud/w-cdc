import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/enterprise/discharge-outlets - 企业提交排污口申请
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { name, latitude, longitude } = body;

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 获取用户 profile 信息
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, park_name, role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: '用户信息不存在' },
        { status: 400 }
      );
    }

    if (profile.role !== 'enterprise') {
      return NextResponse.json(
        { error: '只有企业用户可以申请排污口' },
        { status: 403 }
      );
    }

    // 检查是否已有相同名称的排污口申请
    const { data: existingOutlet } = await supabase
      .from('discharge_outlets')
      .select('id')
      .eq('user_id', user.id)
      .eq('name', name)
      .single();

    if (existingOutlet) {
      return NextResponse.json(
        { error: '已存在相同名称的排污口申请' },
        { status: 400 }
      );
    }

    // 创建排污口申请
    const { data: outlet, error: insertError } = await supabase
      .from('discharge_outlets')
      .insert({
        user_id: user.id,
        park_name: profile.park_name,
        name,
        latitude,
        longitude,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('创建排污口申请失败:', insertError);
      return NextResponse.json(
        { error: '创建排污口申请失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: outlet
    });
  } catch (error) {
    console.error('提交排污口申请异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// GET /api/enterprise/discharge-outlets - 企业获取自己的排污口列表
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 获取当前用户
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 获取用户的排污口列表
    const { data: outlets, error } = await supabase
      .from('discharge_outlets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取排污口列表失败:', error);
      return NextResponse.json(
        { error: '获取排污口列表失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: outlets || []
    });
  } catch (error) {
    console.error('获取排污口列表异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
