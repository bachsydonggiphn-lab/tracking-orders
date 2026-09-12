import React, { useState } from 'react';
import { 
  Copy, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Truck, 
  CheckCheck, 
  AlertCircle,
  Check,
  PackageSearch,
  Hourglass,
  AlertTriangle,
  Zap,
  Sparkles,
  Layers
} from 'lucide-react';
import { OrderItem, TrackingStatusCategory } from '../types/tracking';
import { CARRIERS, getJNTMultiTrackingUrl } from '../services/carrierDetector';
import { getOrderAgeInfo } from '../utils/dateFilter';

interface OrderTableProps {
  orders: OrderItem[];
  onSelectOrder: (order: OrderItem) => void;
  onToast: (msg: string) => void;
  onRetryUnscanned?: () => void;
  onTrackSelected?: (selectedOrders: OrderItem[]) => void;
  onOpenJNT10Modal?: () => void;
  isProcessing?: boolean;
  defaultJtPhone?: string;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  onSelectOrder,
  onToast,
  onRetryUnscanned,
  onTrackSelected,
  onOpenJNT10Modal,
  isProcessing,
  defaultJtPhone = '8836'
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pagination calculation
  const totalItems = orders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const currentOrders = orders.slice(startIndex, startIndex + pageSize);

  const unscannedInView = orders.filter(o => o.statusCategory === 'not_scanned').length;

  // Selected orders
  const selectedOrders = orders.filter(o => selectedIds.has(o.id));
  const selectedJtOrders = selectedOrders.filter(o => o.carrier === 'jt');

  const isAllCurrentPageSelected = currentOrders.length > 0 && currentOrders.every(o => selectedIds.has(o.id));

  const toggleSelectPage = () => {
    const next = new Set(selectedIds);
    if (isAllCurrentPageSelected) {
      currentOrders.forEach(o => next.delete(o.id));
    } else {
      currentOrders.forEach(o => next.add(o.id));
    }
    setSelectedIds(next);
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectFirst10 = () => {
    const next = new Set<string>();
    currentOrders.slice(0, 10).forEach(o => next.add(o.id));
    setSelectedIds(next);
    onToast('Đã chọn 10 đơn trên trang hiện tại.');
  };

  const handleSelect10JT = () => {
    const jtOrders = orders.filter(o => o.carrier === 'jt').slice(0, 10);
    if (jtOrders.length === 0) {
      onToast('Không có đơn J&T Express nào trong danh sách.');
      return;
    }
    const next = new Set<string>();
    jtOrders.forEach(o => next.add(o.id));
    setSelectedIds(next);
    onToast(`Đã chọn ${jtOrders.length} đơn J&T Express.`);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Open multi tracking for selected J&T orders (up to 10)
  const handleOpenSelectedJTWeb = () => {
    if (selectedJtOrders.length === 0) {
      onToast('Chưa chọn đơn J&T Express nào.');
      return;
    }
    const targetCodes = selectedJtOrders.slice(0, 10).map(o => o.trackingCode);
    const phone = selectedJtOrders[0]?.customerPhone || defaultJtPhone || '8836';
    const url = getJNTMultiTrackingUrl(targetCodes, phone);
    window.open(url, '_blank');
    onToast(`Đang mở trang tra cứu 1 lần 10 đơn trên J&T Express (${targetCodes.length} mã)...`);
  };

  // Open 10 consecutive J&T orders starting from this row
  const handleOpen10JTFromRow = (clickedOrder: OrderItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const orderIndex = orders.findIndex(o => o.id === clickedOrder.id);
    if (orderIndex === -1) return;

    // Collect clicked order + up to 9 subsequent J&T orders
    const jtCodes: string[] = [clickedOrder.trackingCode];
    for (let i = orderIndex + 1; i < orders.length && jtCodes.length < 10; i++) {
      if (orders[i].carrier === 'jt') {
        jtCodes.push(orders[i].trackingCode);
      }
    }

    const phone = clickedOrder.extraInfo?.customerPhone || defaultJtPhone || '8836';
    const url = getJNTMultiTrackingUrl(jtCodes, phone);
    window.open(url, '_blank');
    onToast(`Đang mở trang tra cứu ${jtCodes.length} đơn J&T trên web hãng...`);
  };

  const handleCopySelectedCodes = async () => {
    if (selectedOrders.length === 0) return;
    const text = selectedOrders.map(o => o.trackingCode).join(', ');
    try {
      await navigator.clipboard.writeText(text);
      onToast(`Đã sao chép ${selectedOrders.length} mã vận đơn!`);
    } catch {}
  };

  const handleTrackSelectedAPI = () => {
    if (selectedOrders.length === 0) return;
    if (onTrackSelected) {
      onTrackSelected(selectedOrders);
      onToast(`Đang quét lại Live API cho ${selectedOrders.length} đơn đã chọn...`);
    }
  };

  const handleCopyCode = async (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      onToast(`Đã sao chép mã: ${code}`);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (category: TrackingStatusCategory, rawText: string, order?: OrderItem) => {
    switch (category) {
      case 'scanned':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700 shrink-0" />
            ĐÃ SCAN (VỪA LẤY)
          </span>
        );
      case 'not_scanned': {
        const ageInfo = order ? getOrderAgeInfo(order) : null;
        const raw = (order?.rawStatusText || '').toLowerCase();
        const detail = (order?.statusDetail || '').toLowerCase();
        const isProblem = raw.includes('kiện vấn đề') || raw.includes('kiện khó');
        const isFailed = raw.includes('không thành công') || raw.includes('hẹn lại') || raw.includes('chưa lấy được') || detail.includes('không thành công') || detail.includes('hẹn lại');
        
        let label = 'CHƯA SCAN (CHỜ LẤY)';
        let badgeStyle = 'bg-amber-100 text-amber-950 border-amber-300';
        let Icon = Clock;

        if (isFailed) {
          label = 'CHƯA SCAN (HẸN LẤY LẠI)';
          badgeStyle = 'bg-rose-100 text-rose-950 border-rose-400 font-black';
          Icon = AlertTriangle;
        } else if (isProblem) {
          label = 'CHƯA SCAN (KIỆN VẤN ĐỀ)';
          badgeStyle = 'bg-amber-200 text-amber-950 border-amber-400 font-black';
          Icon = AlertTriangle;
        }

        return (
          <div className="flex flex-col items-start gap-1">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold shadow-2xs font-mono border ${badgeStyle}`}>
              <Icon className="w-3.5 h-3.5 mr-1 shrink-0" />
              {label}
            </span>
            {ageInfo && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                ageInfo.category === '1day' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                  : ageInfo.category === '2days' 
                  ? 'bg-amber-50 text-amber-900 border border-amber-400 font-bold' 
                  : 'bg-rose-100 text-rose-950 border border-rose-400 font-black animate-pulse'
              }`}>
                {ageInfo.category === '3plus_days' && '⚠️ '}
                {ageInfo.label} • {ageInfo.category === '1day' ? 'Đang đóng hàng' : ageInfo.category === '2days' ? 'Ưu tiên đóng' : 'Tồn đọng'}
              </span>
            )}
          </div>
        );
      }
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-100 text-rose-950 border border-rose-400 shadow-2xs font-mono">
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-rose-700 shrink-0" />
            ĐÃ HỦY (CẦN GIỮ LẠI ĐƠN)
          </span>
        );
      case 'in_transit': {
        const raw = (order?.rawStatusText || '').toLowerCase();
        const isDeliveryFailed = raw.includes('không thành công') || raw.includes('hẹn giao lại');
        const isLastMile = raw.includes('đang giao') || raw.includes('sớm được giao') || raw.includes('trạm giao hàng') || raw.includes('đến trạm') || raw.includes('sắp xếp tài xế');
        
        if (isDeliveryFailed) {
          return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 font-mono shadow-2xs">
              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-700 shrink-0" />
              ĐÃ SCAN (GIAO THẤT BẠI - HẸN LẠI)
            </span>
          );
        }
        
        if (isLastMile) {
          return (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300 font-mono shadow-2xs">
              <Truck className="w-3.5 h-3.5 mr-1 text-indigo-700 shrink-0" />
              ĐÃ SCAN (ĐANG GIAO HÀNG)
            </span>
          );
        }

        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-950 border border-blue-200 font-mono shadow-2xs">
            <Layers className="w-3.5 h-3.5 mr-1 text-blue-700 shrink-0" />
            ĐÃ SCAN (TRUNG CHUYỂN)
          </span>
        );
      }
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs font-mono">
            <CheckCheck className="w-3.5 h-3.5 mr-1 text-emerald-700 shrink-0" />
            ĐÃ SCAN (THÀNH CÔNG)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-purple-50 text-purple-900 border border-purple-200 font-mono">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-purple-700 shrink-0" />
            CHUYỂN HOÀN
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-100 text-red-950 border border-red-300 shadow-2xs font-mono" title={rawText}>
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-700 shrink-0" />
            LỖI TRA CỨU
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
            <AlertCircle className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
            {rawText || 'Chưa rõ'}
          </span>
        );
    }
  };

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <PackageSearch className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Không tìm thấy đơn hàng nào</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Không có kết quả khớp với bộ lọc hoặc từ khóa tìm kiếm. Hãy thử chọn "Tất cả" hoặc xóa ô tìm kiếm.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
      {/* Quick Batch Selection Toolbar */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider mr-1 flex items-center">
            <Sparkles className="w-3.5 h-3.5 mr-1 text-rose-500" />
            Chọn nhanh:
          </span>
          <button
            type="button"
            onClick={handleSelect10JT}
            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
            title="Tự động chọn 10 đơn J&T Express đầu tiên"
          >
            ⚡ Chọn 10 đơn J&T
          </button>
          <button
            type="button"
            onClick={handleSelectFirst10}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Chọn 10 đơn đầu
          </button>
          <button
            type="button"
            onClick={toggleSelectPage}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            {isAllCurrentPageSelected ? 'Bỏ chọn trang này' : 'Chọn cả trang'}
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-2 py-1 text-xs text-slate-400 hover:text-slate-700 transition-colors cursor-pointer font-medium"
            >
              Bỏ chọn ({selectedIds.size})
            </button>
          )}
        </div>

        {onOpenJNT10Modal && (
          <button
            type="button"
            onClick={onOpenJNT10Modal}
            className="inline-flex items-center px-2.5 py-1 text-xs font-bold rounded-lg text-rose-900 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition-colors cursor-pointer shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5" />
            Bộ tra cứu 10 đơn J&T
          </button>
        )}
      </div>

      {/* Sticky Selection Top Action Bar when items selected */}
      {selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md border-b border-slate-800 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2">
            <span className="font-bold bg-slate-800 text-emerald-400 px-2 py-0.5 rounded font-mono">
              Đã chọn {selectedIds.size} đơn
            </span>
            {selectedJtOrders.length > 0 && (
              <span className="text-[11px] text-rose-300 font-mono font-semibold">
                ({selectedJtOrders.length} đơn J&T Express)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedJtOrders.length > 0 && (
              <button
                type="button"
                onClick={handleOpenSelectedJTWeb}
                className="inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer shadow-xs"
                title="Mở tối đa 10 đơn J&T cùng lúc trên cổng tra cứu jtexpress.vn"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Mở 10 đơn trên web J&T ({Math.min(10, selectedJtOrders.length)})
              </button>
            )}

            {onTrackSelected && (
              <button
                type="button"
                onClick={handleTrackSelectedAPI}
                disabled={isProcessing}
                className="inline-flex items-center px-3 py-1.5 rounded-lg font-bold text-xs bg-amber-400 hover:bg-amber-300 text-slate-900 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
              >
                <Zap className="w-3.5 h-3.5 mr-1 text-slate-900" />
                Quét Live API các đơn đã chọn
              </button>
            )}

            <button
              type="button"
              onClick={handleCopySelectedCodes}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg font-semibold text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              Sao chép ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Quick Action Bar for Unscanned Orders */}
      {unscannedInView > 0 && onRetryUnscanned && (
        <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 text-amber-900 font-semibold">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Danh sách có <strong className="font-mono text-amber-950 font-bold">{unscannedInView.toLocaleString()}</strong> đơn Chưa Scan (Chờ lấy)
            </span>
          </div>
          <button
            type="button"
            onClick={onRetryUnscanned}
            disabled={isProcessing}
            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 border border-amber-500 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-950 shrink-0" />
            Cập nhật lại {unscannedInView.toLocaleString()} đơn Chưa Scan ngay
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider font-bold font-mono text-[11px]">
            <tr>
              <th className="py-3 px-2 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllCurrentPageSelected}
                  onChange={toggleSelectPage}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  title="Chọn tất cả trên trang này"
                />
              </th>
              <th className="py-3 px-3.5 w-14 text-center">STT</th>
              <th className="py-3 px-3.5 min-w-[190px]">Mã Vận Đơn</th>
              <th className="py-3 px-3.5 min-w-[130px]">Hãng Vận Chuyển</th>
              <th className="py-3 px-3.5 min-w-[190px]">Trạng Thái Quét</th>
              <th className="py-3 px-3.5 min-w-[260px]">Chi Tiết Tiến Độ</th>
              <th className="py-3 px-3.5 min-w-[140px]">Thời Gian Quét</th>
              <th className="py-3 px-3.5 w-32 text-right pr-4">Thao Tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-800">
            {currentOrders.map((order, idx) => {
              const carrier = CARRIERS[order.carrier] || CARRIERS.unknown;
              const globalIndex = startIndex + idx + 1;
              const isCopied = copiedId === order.trackingCode;
              const isSelected = selectedIds.has(order.id);

              return (
                <tr 
                  key={order.id} 
                  onClick={() => onSelectOrder(order)}
                  className={`hover:bg-slate-50/90 transition-colors cursor-pointer ${
                    order.isChecking ? 'bg-slate-100/70 animate-pulse' : ''
                  } ${
                    isSelected ? 'bg-rose-50/40' : ''
                  } ${
                    order.statusCategory === 'not_scanned' && !isSelected ? 'bg-amber-50/25' : ''
                  } ${
                    order.statusCategory === 'cancelled' && !isSelected ? 'bg-rose-50/25' : ''
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="py-3 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(order.id)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </td>

                  {/* STT */}
                  <td className="py-3 px-3.5 text-center text-slate-400 font-mono text-[11px] font-semibold">
                    {globalIndex}
                  </td>

                  {/* Tracking Code & WMS Identifiers */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-slate-900 text-[13px] tracking-tight">
                        {order.trackingCode}
                      </span>
                      <button
                        onClick={(e) => handleCopyCode(order.trackingCode, e)}
                        className="p-1 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Sao chép mã vận đơn"
                      >
                        {isCopied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* WMS Order No & RefNo if available */}
                    {(order.orderNo || order.refNo || order.warehouseName) && (
                      <div className="flex flex-wrap items-center gap-1 mt-1 font-mono text-[10px]">
                        {order.warehouseName && (
                          <span 
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                            title={`Kho hàng: ${order.warehouseName}`}
                          >
                            {order.warehouseId === '7' ? 'VN02 [HCM]' : order.warehouseId === '4' ? 'VN01' : order.warehouseName}
                          </span>
                        )}
                        {order.orderNo && (
                          <span 
                            onClick={(e) => handleCopyCode(order.orderNo!, e)}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 cursor-pointer font-semibold"
                            title="Click để copy Order No."
                          >
                            Đơn: {order.orderNo}
                          </span>
                        )}
                        {order.refNo && (
                          <span 
                            onClick={(e) => handleCopyCode(order.refNo!, e)}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                            title="Click để copy RefNo."
                          >
                            Ref: {order.refNo.slice(0, 10)}...
                          </span>
                        )}
                      </div>
                    )}

                    {order.extraInfo?.shopName && !order.orderNo && (
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px] mt-0.5">
                        {order.extraInfo.shopName}
                      </div>
                    )}
                  </td>

                  {/* Carrier */}
                  <td className="py-3 px-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border font-mono ${carrier.badgeBg}`}>
                      {carrier.shortName}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3 px-3.5">
                    {order.isChecking ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-900 text-white animate-pulse font-mono">
                        Đang quét...
                      </span>
                    ) : (
                      getStatusBadge(order.statusCategory, order.rawStatusText, order)
                    )}
                  </td>

                  {/* Details / Raw text */}
                  <td className="py-3 px-3.5">
                    <div className="font-semibold text-slate-900 truncate max-w-[320px]">
                      {order.rawStatusText}
                    </div>
                    {order.statusDetail && order.statusDetail !== order.rawStatusText && (
                      <div className="text-[11px] text-slate-500 truncate max-w-[320px] mt-0.5 font-medium">
                        {order.statusDetail}
                      </div>
                    )}
                  </td>

                  {/* Scanned Time */}
                  <td className="py-3 px-3.5 text-slate-600 font-mono text-[11px]">
                    {order.scannedAt && order.statusCategory !== 'not_scanned' ? (
                      <div>
                        <span className="text-slate-900 font-semibold block">{order.scannedAt}</span>
                        {order.updatedAt && order.updatedAt !== order.scannedAt && (
                          <span className="text-[10px] text-slate-500 block font-normal mt-0.5">
                            Cập nhật: {order.updatedAt}
                          </span>
                        )}
                      </div>
                    ) : order.statusCategory === 'not_scanned' ? (
                      <div>
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80 rounded">
                          Chưa scan lấy
                        </span>
                        {order.updatedAt && (
                          <span className="text-[10px] text-slate-500 block font-normal mt-0.5" title="Thời gian tạo/sự kiện mới nhất từ sàn">
                            Tạo: {order.updatedAt}
                          </span>
                        )}
                      </div>
                    ) : order.updatedAt ? (
                      <span className="text-slate-900 font-semibold">{order.updatedAt}</span>
                    ) : (
                      <span className="text-slate-400 italic">Chưa có</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-3.5 text-right pr-4">
                    <div className="flex items-center justify-end space-x-1" onClick={(e) => e.stopPropagation()}>
                      {order.carrier === 'jt' && (
                        <button
                          type="button"
                          onClick={(e) => handleOpen10JTFromRow(order, e)}
                          className="px-1.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                          title="Tra cứu 1 lần 10 đơn J&T trên web hãng (từ đơn này và 9 đơn kế tiếp)"
                        >
                          <span className="flex items-center font-mono font-black text-[10px]">
                            10 <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                          </span>
                        </button>
                      )}
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Xem chi tiết hành trình"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={order.directUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Mở link tra cứu trực tiếp trên hãng"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center space-x-3">
          <span className="font-medium">
            Hiển thị <strong className="font-mono text-slate-900">{startIndex + 1}</strong> – <strong className="font-mono text-slate-900">{Math.min(startIndex + pageSize, totalItems)}</strong> trong tổng số <strong className="font-mono text-slate-900">{totalItems.toLocaleString()}</strong> đơn
          </span>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400 text-[11px] uppercase tracking-wider font-mono">Dòng:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 font-bold text-slate-800 focus:outline-hidden font-mono"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>

        {/* Pagination Buttons */}
        <div className="flex items-center space-x-1 font-mono">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Trang trước"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-2 font-bold text-slate-800">
            Trang {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Trang sau"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
