'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import AMapLoader from '@amap/amap-jsapi-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MapPin,
} from 'lucide-react';

interface PollutantItem {
  id?: string;
  name?: string;
  label?: string;
  threshold?: number;
  unit?: string;
}

interface Application {
  id: string;
  company_name: string;
  company_id: string;
  pollutants: PollutantItem[];
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
  approved_at?: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  content: any;
  is_read: boolean;
  created_at: string;
}

interface DischargeOutlet {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
  approved_at?: string;
  user_id: string;
  profiles?: {
    full_name: string;
    company_name: string;
  };
}

const POLLUTANT_UNITS: Record<string, string> = {
  'COD': 'mg/L',
  'NH-N': 'mg/L',
  'TP': 'mg/L',
  'TN': 'mg/L',
  'pH': '-',
  '重金属': 'μg/L',
  '其他': 'mg/L',
};

// 辅助函数：获取污染物名称
const getPollutantName = (p: PollutantItem): string => {
  return p.label || p.name || p.id || '未知';
};

// 辅助函数：获取污染物键值（用于 thresholds 对象）
const getPollutantKey = (p: PollutantItem): string => {
  return p.id || p.name || p.label || 'unknown';
};

export default function ManagementPage() {
  const { session, user, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'pollutant' | 'discharge'>('pollutant');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [thresholds, setThresholds] = useState<Record<string, { value: string; unit: string }>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showApproved, setShowApproved] = useState(false);
  
  // Discharge outlets state
  const [dischargeOutlets, setDischargeOutlets] = useState<DischargeOutlet[]>([]);
  const [outletMap, setOutletMap] = useState<any>(null);
  const [outletMarkers, setOutletMarkers] = useState<any[]>([]);
  const [outletMapCenter, setOutletMapCenter] = useState<[number, number]>([30.2741, 120.1551]);
  const [outletDialogOpen, setOutletDialogOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<DischargeOutlet | null>(null);
  const [outletRejectReason, setOutletRejectReason] = useState('');

  useEffect(() => {
    if (!isLoading && !session) {
      router.push('/login');
    }
  }, [session, isLoading, router]);

  useEffect(() => {
    if (session) {
      fetchApplications();
      fetchDischargeOutlets();
    }
  }, [session]);

  const fetchDischargeOutlets = async () => {
    try {
      const res = await fetch('/api/admin/discharge-outlets', {
        headers: { 'x-session': session!.access_token },
      });
      if (res.ok) {
        const data = await res.json();
        // API 返回 { success: true, data: { pending, approved, rejected } } 格式
        const allOutlets = [
          ...(data.data?.pending || []),
          ...(data.data?.approved || []),
        ];
        setDischargeOutlets(allOutlets);
      }
    } catch (error) {
      console.error('Failed to fetch discharge outlets:', error);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await fetch('/api/admin/applications', {
        headers: { 'x-session': session!.access_token },
      });
      if (res.ok) {
        const data = await res.json();
        // API 返回 { pending: [], approved: [] } 格式
        const allApplications = [...(data.pending || []), ...(data.approved || [])];
        setApplications(allApplications);
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedApp) return;

    const pollutants = selectedApp.pollutants.map((p) => ({
      ...p,
      threshold: parseFloat(thresholds[getPollutantKey(p)]?.value || '0'),
      unit: thresholds[getPollutantKey(p)]?.unit || POLLUTANT_UNITS[getPollutantName(p)] || 'mg/L',
    }));

    try {
      const res = await fetch('/api/admin/applications/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session!.access_token,
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          thresholds: pollutants,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchApplications();
      } else {
        const data = await res.json();
        alert(data.error || '审批失败');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('审批失败');
    }
  };

  const handleReject = async () => {
    if (!selectedApp) return;

    try {
      const res = await fetch('/api/admin/applications/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session!.access_token,
        },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          rejectReason,
        }),
      });

      if (res.ok) {
        setDialogOpen(false);
        setRejectReason('');
        fetchApplications();
      } else {
        const data = await res.json();
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('操作失败');
    }
  };

  const openApprovalDialog = (app: Application) => {
    setSelectedApp(app);
    const initialThresholds: Record<string, { value: string; unit: string }> = {};
    app.pollutants.forEach((p) => {
      const key = getPollutantKey(p);
      initialThresholds[key] = {
        value: p.threshold?.toString() || '',
        unit: p.unit || POLLUTANT_UNITS[getPollutantName(p)] || 'mg/L',
      };
    });
    setThresholds(initialThresholds);
    setRejectReason('');
    setDialogOpen(true);
  };

  const handleOutletApprove = async () => {
    if (!selectedOutlet) return;

    try {
      const res = await fetch('/api/admin/discharge-outlets/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session!.access_token,
        },
        body: JSON.stringify({ outletId: selectedOutlet.id }),
      });

      if (res.ok) {
        setOutletDialogOpen(false);
        fetchDischargeOutlets();
      } else {
        const data = await res.json();
        alert(data.error || '审批失败');
      }
    } catch (error) {
      console.error('Failed to approve outlet:', error);
      alert('审批失败');
    }
  };

  const handleOutletReject = async () => {
    if (!selectedOutlet) return;

    try {
      const res = await fetch('/api/admin/discharge-outlets/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session': session!.access_token,
        },
        body: JSON.stringify({
          outletId: selectedOutlet.id,
          rejectReason: outletRejectReason,
        }),
      });

      if (res.ok) {
        setOutletDialogOpen(false);
        setOutletRejectReason('');
        fetchDischargeOutlets();
      } else {
        const data = await res.json();
        alert(data.error || '操作失败');
      }
    } catch (error) {
      console.error('Failed to reject outlet:', error);
      alert('操作失败');
    }
  };

  const openOutletDialog = (outlet: DischargeOutlet) => {
    setSelectedOutlet(outlet);
    setOutletRejectReason('');
    setOutletDialogOpen(true);
  };

  const pendingApps = applications.filter((a) => a.status === 'pending');
  const approvedApps = applications.filter((a) => a.status === 'approved');
  const rejectedApps = applications.filter((a) => a.status === 'rejected');

  // Filter discharge outlets (only pending and approved, not rejected)
  const pendingOutlets = dischargeOutlets.filter((o) => o.status === 'pending');
  const approvedOutlets = dischargeOutlets.filter((o) => o.status === 'approved');
  const displayOutlets = [...pendingOutlets, ...approvedOutlets];

  // Initialize outlet map when tab changes to discharge
  useEffect(() => {
    if (activeTab === 'discharge' && !outletMap && typeof window !== 'undefined') {
      AMapLoader.load({
        key: '2e7e0b14442f42267a79052677e15dce',
        version: '2.0',
        plugins: ['AMap.Scale', 'AMap.ToolBar', 'AMap.Marker'],
      }).then((AMap) => {
        const mapInstance = new AMap.Map('outlet-map-container', {
          zoom: 13,
          center: outletMapCenter,
          resizeEnable: true,
        });
        setOutletMap(mapInstance);
      });
    }
  }, [activeTab]);

  // Update outlet markers when map or outlets change
  useEffect(() => {
    if (outletMap && displayOutlets.length > 0) {
      outletMarkers.forEach((marker) => marker.setMap(null));
      
      const newMarkers = displayOutlets.map((outlet) => {
        const color = outlet.status === 'pending' ? '#F59E0B' : '#10B981';
        const markerContent = document.createElement('div');
        markerContent.style.cssText = `
          width: 28px; height: 28px; border-radius: 50%;
          background: ${color}; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: bold; font-size: 12px;
        `;
        markerContent.innerHTML = '<span>排</span>';
        
        const marker = new outletMap.Marker({
          position: new outletMap.lnglat(outlet.longitude, outlet.latitude),
          content: markerContent,
          offset: new outletMap.Pixel(-14, -14),
        });
        
        const companyName = outlet.profiles?.company_name || '未知企业';
        const statusText = outlet.status === 'pending' ? '待审批' : '已通过';
        const statusColor = outlet.status === 'pending' ? '#F59E0B' : '#10B981';
        
        marker.on('click', () => {
          const infoWindow = new outletMap.InfoWindow({
            content: `
              <div style="padding:10px;min-width:180px;font-family:'Noto Sans SC',sans-serif;">
                <div style="font-weight:600;font-size:14px;margin-bottom:6px;">${outlet.name}</div>
                <div style="font-size:12px;color:#64748B;margin-bottom:4px;">${companyName}</div>
                <div style="font-size:12px;">
                  状态：<span style="color:${statusColor};font-weight:500;">${statusText}</span>
                </div>
              </div>
            `,
            offset: new outletMap.Pixel(0, -30),
          });
          infoWindow.open(outletMap, marker.getPosition());
        });
        
        marker.setMap(outletMap);
        return marker;
      });
      
      setOutletMarkers(newMarkers);
      
      if (displayOutlets.length > 0) {
        const firstOutlet = displayOutlets[0];
        outletMap.setCenter([firstOutlet.latitude, firstOutlet.longitude]);
      }
    }
  }, [outletMap, displayOutlets]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">加载中...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">企业管理</h1>
        <p className="text-sm text-gray-500 mt-1">审批企业的污染物和排污口申请</p>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('pollutant')}
          className={cn(
            'pb-3 px-4 text-sm font-medium transition-colors relative',
            activeTab === 'pollutant'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          污染物审批
          {pendingApps.length > 0 && (
            <Badge className="ml-2 bg-red-500 text-white text-xs">
              {pendingApps.length}
            </Badge>
          )}
          {activeTab === 'pollutant' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab('discharge')}
          className={cn(
            'pb-3 px-4 text-sm font-medium transition-colors relative',
            activeTab === 'discharge'
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          排污口审批
          {activeTab === 'discharge' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></div>
          )}
        </button>
      </div>

      {activeTab === 'pollutant' && (
        <div className="space-y-6">
          {/* 待审批列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-orange-500" />
                待审批申请
                <Badge variant="secondary" className="ml-2">
                  {pendingApps.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApps.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>暂无待审批申请</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-gray-900">
                            {app.company_name}
                          </h3>
                          <Badge variant="outline" className="text-xs">
                            待审批
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {app.pollutants.map((p, idx) => (
                            <Badge key={`${app.id}-${idx}`} variant="secondary" className="text-xs">
                              {getPollutantName(p)}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          申请时间：{new Date(app.created_at).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <Button
                        onClick={() => openApprovalDialog(app)}
                        className="ml-4"
                      >
                        审批
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 已审批列表 */}
          {(approvedApps.length > 0 || rejectedApps.length > 0) && (
            <Card>
              <CardHeader>
                <button
                  onClick={() => setShowApproved(!showApproved)}
                  className="flex items-center justify-between w-full"
                >
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    已审批记录
                    <Badge variant="secondary" className="ml-2">
                      {approvedApps.length + rejectedApps.length}
                    </Badge>
                  </CardTitle>
                  {showApproved ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </CardHeader>
              {showApproved && (
                <CardContent>
                  <div className="space-y-3">
                    {approvedApps.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-green-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">
                              {app.company_name}
                            </h3>
                            <Badge className="bg-green-500 text-white text-xs">
                              已通过
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {app.pollutants.map((p, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {getPollutantName(p)}: {p.threshold} {p.unit}
                              </Badge>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            审批时间：{new Date(app.approved_at!).toLocaleString('zh-CN')}
                          </p>
                        </div>
                      </div>
                    ))}
                    {rejectedApps.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-red-50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-medium text-gray-900">
                              {app.company_name}
                            </h3>
                            <Badge className="bg-red-500 text-white text-xs">
                              已拒绝
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {app.pollutants.map((p, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {getPollutantName(p)}
                              </Badge>
                            ))}
                          </div>
                          {app.reject_reason && (
                            <p className="text-xs text-red-600 mt-2">
                              拒绝原因：{app.reject_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {activeTab === 'discharge' && (
        <div className="flex gap-4 p-4">
          {/* Left: Map */}
          <div className="flex-1">
            <div className="relative rounded-lg border bg-white shadow-sm">
              <div id="outlet-map-container" style={{ height: 520, borderRadius: 8 }} />
              <div className="absolute top-3 left-3 z-10 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-amber-500 border-2 border-white shadow-sm" />
                    <span className="text-gray-600">待审批 ({pendingOutlets.length})</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                    <span className="text-gray-600">已通过 ({approvedOutlets.length})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Outlet List */}
          <div className="w-80 space-y-4">
            {/* Pending Outlets */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-amber-500" />
                待审批排污口
              </h3>
              {pendingOutlets.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无待审批排污口</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {pendingOutlets.map((outlet) => (
                    <div
                      key={outlet.id}
                      className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100 cursor-pointer hover:border-amber-300 transition-colors"
                      onClick={() => {
                        if (outletMap) {
                          outletMap.setCenter([outlet.longitude, outlet.latitude]);
                          outletMap.setZoom(16);
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{outlet.name}</p>
                        <p className="text-xs text-gray-500">{outlet.profiles?.company_name}</p>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openOutletDialog(outlet);
                        }}
                      >
                        审批
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Approved Outlets */}
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                已通过排污口
              </h3>
              {approvedOutlets.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无已通过排污口</p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                  {approvedOutlets.map((outlet) => (
                    <div
                      key={outlet.id}
                      className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100 cursor-pointer hover:border-emerald-300 transition-colors"
                      onClick={() => {
                        if (outletMap) {
                          outletMap.setCenter([outlet.longitude, outlet.latitude]);
                          outletMap.setZoom(16);
                        }
                      }}
                    >
                      <div>
                        <p className="font-medium text-sm">{outlet.name}</p>
                        <p className="text-xs text-gray-500">{outlet.profiles?.company_name}</p>
                      </div>
                      <Badge className="bg-emerald-100 text-emerald-700">已通过</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 排污口审批弹窗 */}
      <Dialog open={outletDialogOpen} onOpenChange={setOutletDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>排污口审批</DialogTitle>
            <DialogDescription>
              审批企业的排污口申请
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">排污口信息</Label>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">名称</span>
                  <span className="text-sm font-medium">{selectedOutlet?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">企业</span>
                  <span className="text-sm font-medium">{selectedOutlet?.profiles?.company_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">坐标</span>
                  <span className="text-sm font-mono text-xs">
                    {selectedOutlet?.latitude.toFixed(6)}, {selectedOutlet?.longitude.toFixed(6)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium">拒绝原因（可选）</Label>
              <Input
                placeholder="如不通过，请填写原因"
                value={outletRejectReason}
                onChange={(e) => setOutletRejectReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleOutletReject}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              拒绝
            </Button>
            <Button onClick={handleOutletApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审批弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>污染物审批 - {selectedApp?.company_name}</DialogTitle>
            <DialogDescription>
              设置阈值并审批企业的污染物申请
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">申请污染物</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedApp?.pollutants.map((p, idx) => (
                  <Badge key={`${selectedApp.id}-${idx}`} variant="secondary" className="px-3 py-1">
                    {getPollutantName(p)}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-3 block">设置阈值</Label>
              <div className="space-y-3">
                {selectedApp?.pollutants.map((p) => {
                  const key = getPollutantKey(p);
                  const name = getPollutantName(p);
                  return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-32 text-sm">{name}</span>
                    <Input
                      type="number"
                      placeholder="阈值"
                      value={thresholds[key]?.value || ''}
                      onChange={(e) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            value: e.target.value,
                            unit: prev[key]?.unit || POLLUTANT_UNITS[name] || 'mg/L',
                          },
                        }))
                      }
                      className="flex-1"
                    />
                    <Select
                      value={thresholds[key]?.unit || POLLUTANT_UNITS[name] || 'mg/L'}
                      onValueChange={(value) =>
                        setThresholds((prev) => ({
                          ...prev,
                          [key]: {
                            ...prev[key],
                            unit: value,
                          },
                        }))
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mg/L">mg/L</SelectItem>
                        <SelectItem value="μg/L">μg/L</SelectItem>
                        <SelectItem value="-">-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium">拒绝原因（可选）</Label>
              <Input
                placeholder="如不通过，请填写原因"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                handleReject();
              }}
              className="border-red-200 text-red-600 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4 mr-2" />
              拒绝
            </Button>
            <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
