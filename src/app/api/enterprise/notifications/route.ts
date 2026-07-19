import { NextResponse } from 'next/server';
import { getSupabaseClient, getSupabaseServiceRoleKey } from '@/storage/database/supabase-client';

export async function GET(request: Request) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const serviceKey = getSupabaseServiceRoleKey();
    const db = getSupabaseClient(serviceKey);

    const {
      data: { user },
    } = await db.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    const { data: notifications, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('查询通知失败:', error);
      return NextResponse.json({ error: '查询失败' }, { status: 500 });
    }

    const unreadCount = notifications?.filter((n) => !n.is_read).length || 0;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (error) {
    console.error('获取通知失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    const serviceKey = getSupabaseServiceRoleKey();
    const db = getSupabaseClient(serviceKey);

    const {
      data: { user },
    } = await db.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (markAllRead) {
      // 标记所有为已读
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (error) {
        console.error('标记已读失败:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }
    } else if (notificationId) {
      // 标记单个为已读
      const { error } = await db
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', profile.id);

      if (error) {
        console.error('标记已读失败:', error);
        return NextResponse.json({ error: '操作失败' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新通知失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get('x-session');
    if (!token) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const serviceKey = getSupabaseServiceRoleKey();
    const db = getSupabaseClient(serviceKey);

    const {
      data: { user },
    } = await db.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: '认证失败' }, { status: 401 });
    }

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    // 删除已读通知
    const { error } = await db
      .from('notifications')
      .delete()
      .eq('user_id', profile.id)
      .eq('is_read', true);

    if (error) {
      console.error('删除通知失败:', error);
      return NextResponse.json({ error: '删除失败' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除通知失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
