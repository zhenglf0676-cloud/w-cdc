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

// POST /api/admin/discharge-outlets/approve - 管理员审批通过排污口
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();
    const { outletId } = body;

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

    // 获取企业信息
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', outlet.user_id)
      .single();

    // 更新排污口状态
    const { error: updateError } = await supabase
      .from('discharge_outlets')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('id', outletId);

    if (updateError) {
      console.error('审批排污口失败:', updateError);
      return NextResponse.json(
        { error: '审批排污口失败' },
        { status: 500 }
      );
    }

    // 获取企业名称
    const enterpriseName = profile?.full_name || '未知企业';

    // 创建通知（使用 profile.id 而不是 outlet.user_id）
    if (profile?.id) {
      // 检查是否已经存在相同的通知（防重复）
      const { data: existingNotifications } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', profile.id)
        .eq('type', 'discharge_outlet_approved')
        .eq('content->>message', `您申请的排污口"${outlet.name}"已通过审批`)
        .limit(1);

      // 只有在不存在相同通知时才创建
      if (!existingNotifications || existingNotifications.length === 0) {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: profile.id,
            type: 'discharge_outlet_approved',
            title: '排污口申请已通过',
            content: { message: `您申请的排污口"${outlet.name}"已通过审批` },
            is_read: false
          });

        if (notificationError) {
          console.error('创建通知失败:', notificationError);
        } else {
          console.log('创建通知成功:', { user_id: profile.id, type: 'discharge_outlet_approved' });
        }
      } else {
        console.log('通知已存在，跳过创建:', { user_id: profile.id, type: 'discharge_outlet_approved' });
      }
    }

    return NextResponse.json({
      success: true,
      message: '审批通过'
    });
  } catch (error) {
    console.error('审批排污口异常:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
