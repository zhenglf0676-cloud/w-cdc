'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getSupabaseBrowserClientWithRetry } from '@/lib/supabase-browser';
import { EnterpriseSidebar } from '@/components/enterprise-sidebar';
import { cn } from '@/lib/utils';
import {
  FileText,
  Bell,
  User,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Mail,
  MailOpen,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  content: any;
  is_read: boolean;
  created_at: string;
}

interface PollutantItem {
  id?: string;
  name?: string;
  label?: string;
  threshold?: number;
  unit?: string;
}

export default function EnterpriseProfilePage() {
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'messages' | 'applications' | 'info'>('messages');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  // 认证检查
  useEffect(() => {
    if (!authLoading && !session) {
      router.push('/login');
    }
  }, [session, authLoading, router]);

  // 获取消息列表
  useEffect(() => {
    if (!session) return;

    const fetchNotifications = async () => {
      try {
        const response = await fetch('/api/enterprise/notifications', {
          headers: {
            'x-session': session.access_token,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [session]);

  // 标记消息为已读
  const markAsRead = async (id: string) => {
    try {
      const response = await fetch('/api/enterprise/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session?.access_token || '',
        },
        body: JSON.stringify({ notificationId: id }),
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // 打开消息详情
  const openNotification = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
  };

  // 标记全部已读
  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/enterprise/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session?.access_token || '',
        },
        body: JSON.stringify({ markAllRead: true }),
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // 清空已读消息
  const clearRead = async () => {
    try {
      const response = await fetch('/api/enterprise/notifications', {
        method: 'DELETE',
        headers: {
          'x-session': session?.access_token || '',
        },
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((n) => !n.is_read));
      }
    } catch (error) {
      console.error('Failed to clear read:', error);
    }
  };

  // 获取未读数量
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 获取消息图标
  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'approval_approved':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'approval_rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Bell className="h-5 w-5 text-blue-600" />;
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="mt-4 text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="p-6">
      {/* 顶部导航 */}
        <header className="sticky top-0 z-30 border-b bg-white">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-lg font-semibold text-foreground">个人中心</h1>
          </div>
        </header>

        <div className="flex">
          {/* 左侧菜单 */}
          <aside className="w-64 border-r bg-white min-h-[calc(100vh-4rem)]">
            <nav className="p-4 space-y-1">
              <button
                onClick={() => setActiveTab('info')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeTab === 'info'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <User className="h-4 w-4" />
                企业信息
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  activeTab === 'applications'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <FileText className="h-4 w-4" />
                我的申请
              </button>
              <button
                onClick={() => setActiveTab('messages')}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                  activeTab === 'messages'
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="flex items-center gap-3">
                  <Bell className="h-4 w-4" />
                  消息中心
                </span>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            </nav>
          </aside>

          {/* 右侧内容区 */}
          <main className="flex-1 p-6">
            {activeTab === 'messages' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">消息中心</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={markAllAsRead}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors"
                    >
                      标记全部已读
                    </button>
                    <button
                      onClick={clearRead}
                      className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted transition-colors text-red-600"
                    >
                      清空已读
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Mail className="h-12 w-12 mb-4 opacity-50" />
                    <p>暂无消息</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => openNotification(notification)}
                        className={cn(
                          'p-4 rounded-lg border transition-all cursor-pointer group',
                          notification.is_read
                            ? 'bg-white hover:bg-muted/50 hover:shadow-sm'
                            : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:shadow-md'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'mt-0.5',
                            notification.type === 'approval_approved' ? 'text-green-600' :
                            notification.type === 'approval_rejected' ? 'text-red-600' :
                            'text-blue-600'
                          )}>
                            {getMessageIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={cn(
                                'font-medium text-sm truncate',
                                !notification.is_read && 'text-blue-900'
                              )}>
                                {notification.title}
                              </h3>
                              <span className="text-xs text-muted-foreground ml-2">
                                {formatTime(notification.created_at)}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {notification.content?.message || 
                                (notification.type === 'approval_approved' && '您的污染物申请已通过审批') ||
                                (notification.type === 'approval_rejected' && `您的申请未通过${notification.content?.reject_reason ? '，原因：' + notification.content.reject_reason : ''}`) ||
                                '您有一条新消息'}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={cn(
                                'text-xs px-2 py-0.5 rounded',
                                notification.type === 'approval_approved' ? 'bg-green-100 text-green-700' :
                                notification.type === 'approval_rejected' ? 'bg-red-100 text-red-700' :
                                'bg-blue-100 text-blue-700'
                              )}>
                                {notification.type === 'approval_approved' ? '审批通过' :
                                 notification.type === 'approval_rejected' ? '审批拒绝' :
                                 '系统通知'}
                              </span>
                              <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                点击查看详情 →
                              </span>
                            </div>
                          </div>
                          {!notification.is_read && (
                            <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 animate-pulse"></div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'applications' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">我的申请</h2>
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-50" />
                  <p>申请记录功能开发中...</p>
                </div>
              </div>
            )}

            {activeTab === 'info' && (
              <div>
                <h2 className="text-xl font-semibold mb-6">企业信息</h2>
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <User className="h-12 w-12 mb-4 opacity-50" />
                  <p>企业信息功能开发中...</p>
                </div>
              </div>
            )}
          </main>
        </div>

      {/* 消息详情弹窗 */}
      {selectedNotification && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedNotification(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-medium text-lg">
                {selectedNotification.title}
              </h3>
              <button
                onClick={() => setSelectedNotification(null)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* 弹窗内容 - 信件风格 */}
            <div className="px-8 py-6">
              {/* 正文 */}
              <div className="text-gray-700 leading-relaxed whitespace-pre-line">
                {selectedNotification.content?.message || '您有一条新消息'}
              </div>

              {/* 时间 */}
              <p className="text-sm text-gray-500 mt-6 pt-4 border-t text-right">
                时间：{new Date(selectedNotification.created_at).toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
