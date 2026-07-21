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
    const { applicationId, thresholds } = body;

    if (!applicationId || !thresholds) {
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
      .select('*, profiles(company_name)')
      .eq('id', applicationId)
      .single();

    if (!application) {
      return NextResponse.json({ error: '申请不存在' }, { status: 404 });
    }

    const companyName = application.profiles?.company_name || '未知企业';

    // 更新申请状态
    const { error: updateError } = await db
      .from('pollutant_applications')
      .update({
        status: 'approved',
        pollutants: thresholds,
        approved_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateError) {
      console.error('更新申请失败:', updateError);
      return NextResponse.json({ error: '审批失败' }, { status: 500 });
    }

    // 创建通知
    const pollutantNames = thresholds.map((t: any) => t.label || t.name || t.id).join('、');
    const pollutantDetails = thresholds.map((t: any) => {
      const name = t.label || t.name || t.id;
      const threshold = t.threshold || 0;
      const unit = t.unit || 'mg/L';
      return `${name}：${threshold}${unit}`;
    }).join('；');
    
    const messageContent = `【${companyName}】您好，您提交的${pollutantNames}污染物排放申请已审核通过！\n该污染物许可排放阈值：${pollutantDetails}，请严格按限值规范排污。`;
    
    // 检查是否已经存在相同的通知（防重复）
    const { data: existingNotifications } = await db
      .from('notifications')
      .select('id')
      .eq('user_id', application.company_id)
      .eq('type', 'approval_approved')
      .eq('content->>message', messageContent)
      .limit(1);

    // 只有在不存在相同通知时才创建
    if (!existingNotifications || existingNotifications.length === 0) {
      const { error: notificationError } = await db
        .from('notifications')
        .insert({
          user_id: application.company_id,
          type: 'approval_approved',
          title: '污染物审批通过',
          content: {
            application_id: applicationId,
            pollutants: thresholds,
            message: messageContent,
          },
        });

      if (notificationError) {
        console.error('创建通知失败:', notificationError);
      }
    } else {
      console.log('通知已存在，跳过创建:', { user_id: application.company_id, type: 'approval_approved' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('审批失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
