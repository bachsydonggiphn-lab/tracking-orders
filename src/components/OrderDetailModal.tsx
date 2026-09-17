import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertOctagon, 
  Truck, 
  Package, 
  Building2,
  Calendar,
  Check,
  RefreshCw,
  Radio,
  Timer,
  AlertTriangle
} from 'lucide-react';
import { OrderItem } from '../types/tracking';
import { CARRIERS, getJNTMultiTrackingUrl } from '../services/carrierDetector';
import { getStatusLabel } from '../services/exportService';
import { getOrderAgeInfo } from '../utils/dateFilter';
import { classifyLogisticsStatus } from '../services/trackingService';

interface OrderDetailModalProps {
  order: OrderItem | null;
  onClose: () => void;
  onToast: (msg: string) => void;
  onRefresh?: (order: OrderItem, customPhone?: string) => Promise<void>;
  onUpdateOrder?: (order: OrderItem) => void;
  defaultJtSuffix?: string;
  allOrders?: OrderItem[];
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onToast,
  onRefresh,
  onUpdateOrder,
  defaultJtSuffix = '8836',
  allOrders = []
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [phoneSuffix, setPhoneSuffix] = useState<string>(() => {
    return order?.extraInfo?.customerPhone?.replace(/\D/g, '').slice(-4) || defaultJtSuffix || '8836';
  });
  const [timeline, setTimeline] = useState<any[]>(() => order?.timeline || []);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // Compute effective status derived from timeline events to avoid stale/erroneous 'not_scanned' status
  const effectiveStatus = React.useMemo(() => {
    if (!order) return { statusCategory: 'not_scanned', rawStatusText: '', statusDetail: '', scannedAt: undefined };
    if (!timeline || timeline.length === 0) {
      return {
        statusCategory: order.statusCategory,
        rawStatusText: order.rawStatusText,
        statusDetail: order.statusDetail,
        scannedAt: order.scannedAt
      };
    }

    const latestEvent = timeline[0];
    const rawText = latestEvent?.statusText || order.rawStatusText || '';
    const classified = classifyLogisticsStatus(rawText, timeline, order.statusCategory);

    return {
      statusCategory: classified.statusCategory,
      rawStatusText: rawText || order.rawStatusText,
      statusDetail: latestEvent?.location ? `Bưu cục: ${latestEvent.location}` : (order.statusDetail || ''),
      scannedAt: classified.scannedAt || order.scannedAt
    };
  }, [order, timeline]);

  React.useEffect(() => {
    if (!order) return;
    if (order.timeline && order.timeline.length > 0) {
      setTimeline(order.timeline);
      const classified = classifyLogisticsStatus(order.timeline[0]?.statusText || order.rawStatusText, order.timeline, order.statusCategory);
      if (classified.statusCategory !== order.statusCategory && classified.statusCategory !== 'not_scanned' && onUpdateOrder) {
        onUpdateOrder({
          ...order,
          statusCategory: classified.statusCategory,
          rawStatusText: order.timeline[0]?.statusText || order.rawStatusText,
          statusDetail: order.timeline[0]?.location ? `Bưu cục: ${order.timeline[0].location}` : order.statusDetail,
          scannedAt: classified.scannedAt || order.scannedAt,
          timeline: order.timeline
        });
      }
      return;
    }

    let isMounted = true;
    setIsLoadingTimeline(true);
    fetch(`/api/orders/${encodeURIComponent(order.trackingCode)}/timeline`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && Array.isArray(data.timeline)) {
          setTimeline(data.timeline);
          if (data.timeline.length > 0) {
            const classified = classifyLogisticsStatus(data.timeline[0]?.statusText || order.rawStatusText, data.timeline, order.statusCategory);
            if (classified.statusCategory !== order.statusCategory && classified.statusCategory !== 'not_scanned' && onUpdateOrder) {
              onUpdateOrder({
                ...order,
                statusCategory: classified.statusCategory,
                rawStatusText: data.timeline[0]?.statusText || order.rawStatusText,
                statusDetail: data.timeline[0]?.location ? `Bưu cục: ${data.timeline[0].location}` : order.statusDetail,
                scannedAt: classified.scannedAt || order.scannedAt,
                timeline: data.timeline
              });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingTimeline(false);
      });

    return () => {
      isMounted = false;
    };
  }, [order?.trackingCode]);

  if (!order) return null;

  const handleOpen10JT = () => {
    if (!order) return;
    const orderIndex = allOrders.findIndex(o => o.id === order.id);
    const jtCodes: string[] = [order.trackingCode];

    if (orderIndex !== -1) {
      for (let i = orderIndex + 1; i < allOrders.length && jtCodes.length < 10; i++) {
        if (allOrders[i].carrier === 'jt') {
          jtCodes.push(allOrders[i].trackingCode);
        }
      }
    }

    const phone = phoneSuffix || '8836';
    const url = getJNTMultiTrackingUrl(jtCodes, phone);
    window.open(url, '_blank');
    onToast(`Đang mở tra cứu ${jtCodes.length} đơn J&T trên web hãng...`);
  };

  const carrier = CARRIERS[order.carrier] || CARRIERS.unknown;
  const ageInfo = getOrderAgeInfo(order);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(order.trackingCode);
      onToast(`Đã sao chép mã ${order.trackingCode}`);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLiveRefresh = async (customPhone?: string) => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh(order, customPhone || phoneSuffix);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getDirectUrl = () => {
    if (order.carrier === 'ghn' || order.trackingCode.startsWith('VNGH') || order.trackingCode.startsWith('GY') || order.trackingCode.startsWith('G8') || order.trackingCode.startsWith('GHN')) {
      return `https://donhang.ghn.vn/?order_code=${encodeURIComponent(order.trackingCode.trim())}`;
    }
    if (order.carrier === 'spx' || order.trackingCode.startsWith('SPXVN') || order.trackingCode.startsWith('SPX')) {
      return `https://spx.vn/track?${encodeURIComponent(order.trackingCode.trim())}`;
    }
    if (order.carrier === 'jt_cargo' || order.trackingCode.startsWith('530') || (order.trackingCode.startsWith('53') && order.trackingCode.length >= 11)) {
      return `https://office.jtcargo.com.vn/trade/orderQuery?bills=${encodeURIComponent(order.trackingCode.trim())}`;
    }
    if (order.carrier === 'jt') {
      const p = phoneSuffix || '8836';
      return `https://jtexpress.vn/vi/tracking?type=track&billcode=${encodeURIComponent(order.trackingCode)}&cellphone=${encodeURIComponent(p)}`;
    }
    return order.directUrl;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border font-mono ${carrier.badgeBg}`}>
              {carrier.name}
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-mono text-slate-900">
                  {order.trackingCode}
                </h3>
                <button
                  onClick={handleCopyCode}
                  className="p-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Sao chép mã"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {onRefresh && (
              <button
                onClick={() => handleLiveRefresh()}
                disabled={isRefreshing}
                className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                title="Quét lại trực tiếp từ cổng vận chuyển"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Quét lại</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          
          {/* Error Details Box if present */}
          {(order.statusCategory === 'error' || order.error) && (
            <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 space-y-1 text-xs">
              <div className="flex items-center space-x-1.5 text-red-900 font-bold font-mono">
                <AlertOctagon className="w-4 h-4 text-red-600 shrink-0" />
                <span>LỖI PHẢN HỒI TỪ CỔNG VẬN CHUYỂN</span>
              </div>
              <p className="text-red-700 font-medium">
                {order.error || order.statusDetail || 'Không tìm thấy dữ liệu vận đơn trên cổng hãng vận chuyển.'}
              </p>
              <p className="text-[11px] text-red-600 pt-1 border-t border-red-200">
                Hệ thống báo lỗi thật từ cổng API hãng, không tự động điền trạng thái ảo. Bạn có thể bấm nút "Xem trực tiếp" bên dưới để mở giao diện web của hãng.
              </p>
            </div>
          )}

          {/* Status summary box */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                {effectiveStatus.statusCategory === 'not_scanned' && (effectiveStatus.rawStatusText?.toLowerCase().includes('kiện vấn đề') || effectiveStatus.rawStatusText?.toLowerCase().includes('kiện khó')) ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                ) : (
                  <Radio className={`w-3 h-3 animate-pulse ${effectiveStatus.statusCategory === 'not_scanned' ? 'text-amber-500' : 'text-emerald-500'}`} />
                )}
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider font-mono text-[11px]">Trạng thái hệ thống:</span>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border shadow-2xs font-mono ${
                effectiveStatus.statusCategory === 'not_scanned' && (effectiveStatus.rawStatusText?.toLowerCase().includes('kiện vấn đề') || effectiveStatus.rawStatusText?.toLowerCase().includes('kiện khó'))
                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                  : effectiveStatus.statusCategory === 'scanned'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : effectiveStatus.statusCategory === 'in_transit'
                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                  : effectiveStatus.statusCategory === 'delivered'
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                  : 'bg-white border-slate-200 text-slate-800'
              }`}>
                {effectiveStatus.statusCategory === 'not_scanned' && (effectiveStatus.rawStatusText?.toLowerCase().includes('kiện vấn đề') || effectiveStatus.rawStatusText?.toLowerCase().includes('kiện khó'))
                  ? 'CHƯA SCAN (KIỆN VẤN ĐỀ / KIỆN KHÓ)'
                  : getStatusLabel(effectiveStatus.statusCategory)}
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900">
              {effectiveStatus.rawStatusText}
            </div>

            {effectiveStatus.statusDetail && (
              <p className="text-xs text-slate-600 font-medium">
                {effectiveStatus.statusDetail}
              </p>
            )}

            {/* Age indicator for unscanned / waiting orders */}
            {effectiveStatus.statusCategory === 'not_scanned' && (
              <div className={`p-2.5 rounded-lg border flex items-start space-x-2 text-xs ${
                ageInfo.category === '1day' 
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                  : ageInfo.category === '2days' 
                  ? 'bg-amber-50/80 border-amber-300 text-amber-950' 
                  : 'bg-rose-50 border-rose-300 text-rose-950 font-medium'
              }`}>
                {ageInfo.category === '3plus_days' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold font-mono">
                    Tuổi đơn hàng: {ageInfo.label} ({ageInfo.days} ngày)
                  </div>
                  <div className="text-[11px] mt-0.5">
                    {ageInfo.description}
                  </div>
                </div>
              </div>
            )}

            {(effectiveStatus.scannedAt || order.updatedAt) && (
              <div className="pt-2.5 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-500 font-mono">
                {effectiveStatus.scannedAt && effectiveStatus.statusCategory !== 'not_scanned' ? (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-600 shrink-0" />
                    <span>Quét nhận: <strong className="ml-1 text-slate-900 font-semibold">{effectiveStatus.scannedAt}</strong></span>
                  </div>
                ) : effectiveStatus.statusCategory === 'not_scanned' ? (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600 shrink-0" />
                    <span>Trạng thái: <strong className="ml-1 text-amber-800 font-medium">Chưa quét nhận (Chờ bưu tá)</strong></span>
                  </div>
                ) : null}
                {order.updatedAt && (
                  <div className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-blue-600 shrink-0" />
                    <span>Cập nhật mới nhất: <strong className="ml-1 text-slate-900 font-semibold">{order.updatedAt}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* WMS Metadata Box if available */}
          {(order.orderNo || order.refNo || order.wmsStatus || order.warehouseName) && (
            <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/80 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider font-mono">
                  Dữ liệu từ YunWMS Cloud
                </span>
                <div className="flex items-center space-x-1.5">
                  {order.warehouseName && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-950 border border-emerald-300 font-mono">
                      {order.warehouseName}
                    </span>
                  )}
                  {order.wmsStatus && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">
                      {order.wmsStatus}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 font-mono">
                {order.orderNo && (
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">Order No.:</span>
                    <span className="text-slate-900 font-bold">{order.orderNo}</span>
                  </div>
                )}
                {order.refNo && (
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">RefNo. (Tham chiếu):</span>
                    <span className="text-slate-900 font-bold truncate block">{order.refNo}</span>
                  </div>
                )}
                {order.customerCode && (
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">Mã khách hàng:</span>
                    <span className="text-slate-800 font-semibold">{order.customerCode}</span>
                  </div>
                )}
                {order.carrierChannel && (
                  <div>
                    <span className="text-[10px] text-emerald-700 font-bold block">Kênh vận chuyển WMS:</span>
                    <span className="text-slate-800 font-semibold">{order.carrierChannel}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* J&T Specific Phone Suffix Controller */}
          {order.carrier === 'jt' && (
            <div className="p-3 bg-rose-50/70 rounded-xl border border-rose-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider font-mono">
                  Mở khóa dữ liệu J&T Express (4 số cuối SĐT):
                </span>
                <span className="text-[10px] bg-rose-200/70 text-rose-800 font-bold px-1.5 py-0.5 rounded font-mono">
                  Tự động 8836
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-mono font-bold rounded-lg bg-rose-600 text-white shadow-2xs">
                  8836 (Tự động)
                </span>
                <button
                  onClick={() => handleLiveRefresh('8836')}
                  disabled={isRefreshing}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-lg transition-colors cursor-pointer shadow-2xs ml-auto"
                >
                  <RefreshCw className={`w-3 h-3 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Quét lại trực tiếp (8836)
                </button>
              </div>
              <p className="text-[11px] text-rose-700 leading-tight">
                Hệ thống tự động sử dụng đuôi SĐT <strong>8836</strong> để mở khóa dữ liệu lộ trình trên cổng J&T Express.
              </p>
            </div>
          )}

          {/* Extra Info if available */}
          {order.extraInfo && (order.extraInfo.shopName || order.extraInfo.customerPhone) && (
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
              {order.extraInfo.shopName && (
                <div>
                  <span className="text-slate-400 block font-semibold text-[11px] uppercase tracking-wider font-mono">Shop / Nguồn:</span>
                  <span className="font-semibold text-slate-800">{order.extraInfo.shopName}</span>
                </div>
              )}
              {order.extraInfo.customerPhone && (
                <div>
                  <span className="text-slate-400 block font-semibold text-[11px] uppercase tracking-wider font-mono">SĐT Người Nhận:</span>
                  <span className="font-semibold text-slate-800 font-mono">{order.extraInfo.customerPhone}</span>
                </div>
              )}
            </div>
          )}

          {/* Journey Timeline */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center font-mono">
              <Truck className="w-3.5 h-3.5 mr-1.5 text-slate-700" />
              Lịch sử hành trình bưu kiện
            </h4>

            {isLoadingTimeline ? (
              <div className="flex flex-col items-center justify-center py-6 text-xs text-indigo-600 bg-indigo-50/50 rounded-lg border border-dashed border-indigo-200">
                <RefreshCw className="w-4 h-4 animate-spin mb-1.5" />
                <span>Đang tải lộ trình chi tiết từ SQL...</span>
              </div>
            ) : timeline && timeline.length > 0 ? (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {timeline.map((event, i) => (
                  <div key={i} className="relative group">
                    {/* Timeline Node */}
                    <div className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                      i === 0 ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-mono font-semibold text-slate-500">
                          {event.time}
                        </span>
                        {event.location && (
                          <span className="inline-flex items-center text-[11px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                            <MapPin className="w-2.5 h-2.5 mr-0.5 text-slate-400" />
                            {event.location}
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-semibold text-slate-800">
                        {event.statusText}
                      </div>

                      {event.description && (
                        <p className="text-[11px] text-slate-500">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                Chưa có dữ liệu hành trình chi tiết
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>

          <div className="flex items-center space-x-2">
            {order.carrier === 'jt' && (
              <button
                type="button"
                onClick={handleOpen10JT}
                className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Mở link tra cứu 1 lần 10 đơn J&T trên web hãng (kèm các đơn kế tiếp)"
              >
                <span className="font-mono font-black mr-1.5 text-[10px] bg-rose-600 text-white px-1.5 py-0.2 rounded">10</span>
                Mở 10 đơn trên web J&T <ExternalLink className="w-3 h-3 ml-1" />
              </button>
            )}

            {order.carrier === 'spx' && (
              <a
                href="https://spx.vn/vi"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-2 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors cursor-pointer"
                title="Mở cổng chính thức SPX Express https://spx.vn/vi"
              >
                Cổng spx.vn/vi <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}

            <a
              href={getDirectUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Tra cứu trên web {carrier.shortName} <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
};
