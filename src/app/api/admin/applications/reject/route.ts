import { NextResponse } from 'next/server';
import { getSupabaseCredentials, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { applicationId, rejectReason } = body;

    if (!applicationId) {
      return NextResponse.json({ error: '参数不完整' }, { status: 400 });
    }

    const { url } = getSupabaseCredentials();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    const db = createClient(url, serviceRoleKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 验证管理员身份
    const {
      data: { user },
    } = await db.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { data: adminProfile } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    // 获取申请信息
    const { data: application } = await db
      .from('pollutant_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    }

    // 更新申请状态
    const { error: updateError } = await db
      .from('pollutant_applications')
      .update({
        status: 'rejected',
        reject_reason: rejectReason || null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('更新申请失败:', updateError);
      return NextResponse.json({ error: '审批失败' }, { status: 500 });
    }

    // 创建通知
    const { error: notificationError } = await db
      .from('notifications')
      .insert({
        user_id: application.company_id,
        type: 'approval_rejected',
        title: '污染物审批未通过',
        content: {
          application_id: applicationId,
          reject_reason: rejectReason || '未说明原因',
          message: `您的污染物申请未通过审批。${rejectReason ? `原因：${rejectReason}` : ''}`,
        },
      });

    if (notificationError) {
      console.error('创建通知失败:', notificationError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('拒绝失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
