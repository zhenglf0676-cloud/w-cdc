import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/admin/discharge-outlets - 管理员获取所有排污口申请
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    // 获取所有排污口申请，关联用户信息
    const { data: outlets, error } = await supabase
      .from('discharge_outlets')
      .select(`
        *,
        profiles:user_id (full_name, company_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('获取排污口列表失败:', error);
      return NextResponse.json(
        { error: '获取排污口列表失败' },
        { status: 500 }
      );
    }

    // 按状态分组
    const pending = outlets?.filter(o => o.status === 'pending') || [];
    const approved = outlets?.filter(o => o.status === 'approved') || [];
    const rejected = outlets?.filter(o => o.status === 'rejected') || [];

    return NextResponse.json({
      success: true,
      data: {
        pending,
        approved,
        rejected
      }
    });
  } catch (error) {
    console.error('获取排污口列表异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
