import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

// 使用 service role key 绕过 RLS
function getSupabaseAdmin() {
  const { url, anonKey } = getSupabaseCredentials();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  return createClient(url, serviceRoleKey || anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST /api/admin/discharge-outlets/reject - 管理员审批拒绝排污口
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { outletId, rejectReason } = body;

    if (!outletId) {
      return NextResponse.json(
        { error: '缺少排污口 ID' },
        { status: 400 }
      );
    }

    // 获取排污口信息
    const { data: outlet, error: outletError } = await supabase
      .from('discharge_outlets')
      .select('*')
      .eq('id', outletId)
      .single();

    if (outletError || !outlet) {
      return NextResponse.json(
        { error: '排污口不存在' },
        { status: 404 }
      );
    }

    // 更新排污口状态
    const { error: updateError } = await supabase
      .from('discharge_outlets')
      .update({
        status: 'rejected',
        reject_reason: rejectReason || ''
      })
      .eq('id', outletId);

    if (updateError) {
      console.error('拒绝排污口失败:', updateError);
      return NextResponse.json(
        { error: '拒绝排污口失败' },
        { status: 500 }
      );
    }

    // 创建通知
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: outlet.user_id,
        type: 'discharge_outlet_rejected',
        title: '排污口申请被拒绝',
        content: { 
          message: `您申请的排污口"${outlet.name}"被拒绝`,
          reject_reason: rejectReason || ''
        },
        is_read: false
      });

    if (notificationError) {
      console.error('创建通知失败:', notificationError);
    }

    return NextResponse.json({
      success: true,
      message: '已拒绝'
    });
  } catch (error) {
    console.error('拒绝排污口异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
