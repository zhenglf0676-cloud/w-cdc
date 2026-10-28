import { NextRequest, NextResponse } from 'next/server';
import { requireParkAdmin } from '@/lib/admin-authorization';

// POST /api/admin/discharge-outlets/reject - 管理员审批拒绝排污口
export async function POST(request: NextRequest) {
  try {
    const access = await requireParkAdmin(request);
    if (!access.ok) return access.response;
    const { db: supabase, parkName } = access.context;
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
      .eq('park_name', parkName)
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

    // 创建通知（使用 profile.id 而不是 outlet.user_id）
    if (profile?.id) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: profile.id,
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
      } else {
        console.log('创建通知成功:', { user_id: profile.id, type: 'discharge_outlet_rejected' });
      }
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
