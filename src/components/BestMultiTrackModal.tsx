import React, { useState, useMemo } from 'react';
import { 
  X, 
  ExternalLink, 
  CheckCheck, 
  CheckCircle2, 
  Clock, 
  Copy, 
  Check, 
  Sparkles, 
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { OrderItem, TrackingStatusCategory } from '../types/tracking';
import { getBestMultiTrackingUrl } from '../services/carrierDetector';

interface BestMultiTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  orders: OrderItem[];
  initialCodes?: string[];
  onUpdateOrdersStatus?: (
    orderCodes: string[], 
    newStatus: TrackingStatusCategory, 
    rawText: string, 
    statusDetail: string
  ) => void;
}

export const BestMultiTrackModal: React.FC<BestMultiTrackModalProps> = ({
  isOpen,
  onClose,
  onToast,
  orders,
  initialCodes,
  onUpdateOrdersStatus
}) => {
  // Extract all Best Express orders from current system
  const bestOrders = useMemo(() => {
    return orders.filter(o => o.carrier === 'best' || (o.trackingCode && o.trackingCode.startsWith('TTVN')));
  }, [orders]);

  // Default to first 20 unscanned Best orders (or any first 20 Best orders)
  const defaultCodes = useMemo(() => {
    const unscanned = bestOrders.filter(o => o.statusCategory === 'not_scanned');
    const target = unscanned.length > 0 ? unscanned : bestOrders;
    return target.slice(0, 20).map(o => o.trackingCode);
  }, [bestOrders]);

  const [activeCodes, setActiveCodes] = useState<string[]>(
    initialCodes && initialCodes.length > 0 ? initialCodes : defaultCodes
  );
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  // Sync activeCodes when initialCodes or defaultCodes change or modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialCodes && initialCodes.length > 0) {
        setActiveCodes(initialCodes);
      } else if (defaultCodes.length > 0) {
        setActiveCodes(defaultCodes);
      }
    }
  }, [isOpen, initialCodes, defaultCodes]);

  if (!isOpen) return null;

  const trackingUrl = getBestMultiTrackingUrl(activeCodes);

  const handleCopyCodes = async () => {
    if (activeCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(activeCodes.join(', '));
      setCopiedCodes(true);
      onToast(`Đã sao chép ${activeCodes.length} mã vận đơn Best Express!`);
      setTimeout(() => setCopiedCodes(false), 2000);
    } catch {}
  };

  const handleOpenExternal = () => {
    window.open(trackingUrl, '_blank');
    onToast(`Đang mở ${activeCodes.length} đơn trên website Best Express...`);
  };

  const handleReloadIframe = () => {
    setIframeKey(prev => prev + 1);
    onToast('Đang tải lại khung tra cứu Best Express...');
  };

  // One-click apply "ĐÃ SCAN (BƯU TÁ ĐÃ LẤY)" to all active orders
  const handleMarkAsScanned = () => {
    if (activeCodes.length === 0) {
      onToast('Không có mã đơn nào để cập nhật!');
      return;
    }
    if (onUpdateOrdersStatus) {
      onUpdateOrdersStatus(
        activeCodes,
        'scanned',
        'Đã lấy hàng - Bưu tá Best Express đã scan nhận kiện',
        'Bưu tá đã lấy hàng thành công từ kho • Đã đối soát trên cổng hãng'
      );
    }
    onClose();
  };

  // One-click apply "ĐÃ SCAN (ĐANG GIAO / TRUNG CHUYỂN)"
  const handleMarkAsInTransit = () => {
    if (activeCodes.length === 0) {
      onToast('Không có mã đơn nào để cập nhật!');
      return;
    }
    if (onUpdateOrdersStatus) {
      onUpdateOrdersStatus(
        activeCodes,
        'in_transit',
        'Đang vận chuyển (Trung chuyển / Đang giao)',
        'Kiện hàng đang luân chuyển qua các trạm bưu cục Best Express'
      );
    }
    onClose();
  };

  // Pagination chunks of 20 codes from all Best orders
  const totalBestCount = bestOrders.length;
  const chunkPages = Math.ceil(totalBestCount / 20);

  const handleSelectChunk = (pageIndex: number) => {
    const chunk = bestOrders.slice(pageIndex * 20, (pageIndex + 1) * 20).map(o => o.trackingCode);
    setActiveCodes(chunk);
    setIframeKey(prev => prev + 1);
    onToast(`Đã nạp đợt ${pageIndex + 1} (${chunk.length} đơn Best Express).`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-[#003B73] to-[#0055A5] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-black text-sm text-blue-200">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-bold text-white font-mono">
                  Bộ Tra Cứu Tích Hợp Best Express (Tối Đa 20 Đơn / Lần)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wide">
                  Xoay Captcha 1 lần duy nhất
                </span>
              </div>
              <p className="text-xs text-blue-100/90 mt-0.5">
                Kéo thanh trượt 1 lần ngay trong khung bên dưới để mở khóa hành trình cho cả {activeCodes.length} đơn cùng lúc
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={handleOpenExternal}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1 cursor-pointer"
              title="Mở toàn màn hình trong tab mới"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mở tab ngoài</span>
            </button>
            <button
              type="button"
              onClick={handleReloadIframe}
              className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Tải lại trang tra cứu"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-blue-200 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Control Bar: Chunks selector & Quick Action Buttons */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          
          {/* Batches pagination if more than 20 orders */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-700 text-[11px] uppercase font-mono mr-1">
              Đợt tra cứu ({totalBestCount} đơn):
            </span>
            {Array.from({ length: Math.min(chunkPages, 8) }).map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectChunk(idx)}
                className={`px-2 py-0.5 rounded font-mono text-xs font-bold transition-all cursor-pointer ${
                  activeCodes[0] === bestOrders[idx * 20]?.trackingCode
                    ? 'bg-[#0055A5] text-white shadow-2xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Đợt {idx + 1} ({Math.min(20, totalBestCount - idx * 20)})
              </button>
            ))}

            <button
              type="button"
              onClick={handleCopyCodes}
              className="inline-flex items-center px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 font-mono text-[11px] cursor-pointer ml-1"
              title="Sao chép danh sách mã này"
            >
              {copiedCodes ? <Check className="w-3 h-3 text-emerald-600 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
              <span>{copiedCodes ? 'Đã copy' : 'Copy 20 mã'}</span>
            </button>
          </div>

          {/* Sync status action buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleMarkAsScanned}
              className="inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs cursor-pointer"
              title="Sau khi xoay Captcha thấy bưu tá đã lấy, bấm nút này để cập nhật 20 đơn này sang ĐÃ SCAN trên bảng"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>✓ Cập nhật 20 đơn: ĐÃ SCAN LẤY</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAsInTransit}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer"
              title="Cập nhật 20 đơn sang ĐANG VẬN CHUYỂN"
            >
              <Truck className="w-3.5 h-3.5 mr-1" />
              <span>Đang vận chuyển</span>
            </button>
          </div>
        </div>

        {/* Live Tracking Iframe Workspace */}
        <div className="flex-1 w-full bg-slate-100 relative overflow-hidden min-h-[500px]">
          {activeCodes.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="font-semibold text-sm">Không tìm thấy đơn Best Express nào trong danh sách!</p>
            </div>
          ) : (
            <iframe
              key={iframeKey}
              src={trackingUrl}
              className="w-full h-full border-0"
              style={{ minHeight: '580px', height: '100%' }}
              title="Cổng tra cứu bưu cục Best Express"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          )}
        </div>

        {/* Footer info tip */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-600 gap-2 shrink-0">
          <div className="flex items-center space-x-1.5 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Cơ chế xoay Captcha 1 lần:</strong> Kéo thanh trượt khớp hình trên màn hình, Best Express sẽ tự động giải phóng toàn bộ {activeCodes.length} mã. Sau khi thấy bưu tá đã lấy, bấm nút <strong>"Cập nhật 20 đơn: ĐÃ SCAN LẤY"</strong> ở góc trên để lưu vĩnh viễn vào hệ thống.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 rounded text-slate-700 font-semibold cursor-pointer shrink-0"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
};
