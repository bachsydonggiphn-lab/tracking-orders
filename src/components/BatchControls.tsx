import React, { useState, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Copy, 
  Search, 
  SlidersHorizontal, 
  FileSpreadsheet, 
  FileText, 
  Check, 
  Filter,
  Zap,
  Clock,
  AlertOctagon,
  CheckCircle2,
  Trash2,
  Calendar,
  Timer,
  Layers,
  AlertTriangle,
  FileCode,
  Truck,
  X,
  ExternalLink
} from 'lucide-react';
import { CarrierId, OrderItem, TrackingProgressMetrics, TrackingStatusCategory } from '../types/tracking';
import { CARRIERS } from '../services/carrierDetector';
import { exportOrdersToExcel, exportOrdersToCSV, exportOrdersToJSON, copyCodesToClipboard } from '../services/exportService';
import { isOrderWithinDays, getOrderAgeInfo } from '../utils/dateFilter';

interface BatchControlsProps {
  orders: OrderItem[];
  filteredOrders: OrderItem[];
  isProcessing: boolean;
  onStartTracking: (scope?: 'all' | '3days' | '7days' | '14days' | 'unscanned' | 'unscanned_1day' | 'unscanned_2days' | 'unscanned_3days') => void;
  onPauseTracking: () => void;
  onRetryUnscanned: () => void;
  onRecheckAll: () => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  selectedCarrier: string;
  onCarrierChange: (carrier: string) => void;
  concurrency: number;
  onConcurrencyChange: (val: number) => void;
  onClearAll: () => void;
  onToast: (msg: string) => void;
  metrics?: TrackingProgressMetrics | null;
  activeScope?: string;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  orders,
  filteredOrders,
  isProcessing,
  onStartTracking,
  onPauseTracking,
  onRetryUnscanned,
  onRecheckAll,
  searchTerm,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedCarrier,
  onCarrierChange,
  concurrency,
  onConcurrencyChange,
  onClearAll,
  onToast,
  metrics,
  activeScope = 'all'
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCopyMenu, setShowCopyMenu] = useState(false);
  const [showScopeMenu, setShowScopeMenu] = useState(false);

  // Group counts for tabs & scopes
  const unscannedOrders = useMemo(() => orders.filter(o => o.statusCategory === 'not_scanned'), [orders]);
  const notScannedCount = unscannedOrders.length;
  const inTransitCount = orders.filter(o => o.statusCategory === 'in_transit').length;
  const deliveredCount = orders.filter(o => o.statusCategory === 'delivered').length;
  const scannedOnlyCount = orders.filter(o => o.statusCategory === 'scanned').length;
  const totalScannedCount = scannedOnlyCount + inTransitCount + deliveredCount;
  const cancelledCount = orders.filter(o => o.statusCategory === 'cancelled').length;
  const errorCount = orders.filter(o => o.statusCategory === 'error').length;

  // Unscanned age breakdown
  const unscanned1Day = useMemo(() => unscannedOrders.filter(o => getOrderAgeInfo(o).category === '1day'), [unscannedOrders]);
  const unscanned2Days = useMemo(() => unscannedOrders.filter(o => getOrderAgeInfo(o).category === '2days'), [unscannedOrders]);
  const unscanned3PlusDays = useMemo(() => unscannedOrders.filter(o => getOrderAgeInfo(o).category === '3plus_days'), [unscannedOrders]);

  // Counts by date interval
  const count3Days = useMemo(() => orders.filter(o => isOrderWithinDays(o, 3)).length, [orders]);
  const count7Days = useMemo(() => orders.filter(o => isOrderWithinDays(o, 7)).length, [orders]);
  const count14Days = useMemo(() => orders.filter(o => isOrderWithinDays(o, 14)).length, [orders]);

  // Carrier breakdown statistics (Total & Unscanned counts for each carrier)
  const carrierStats = useMemo(() => {
    const stats = {
      all: { total: orders.length, unscanned: 0 },
      spx: { total: 0, unscanned: 0 },
      jt: { total: 0, unscanned: 0, express: 0, cargo: 0 },
      ghn: { total: 0, unscanned: 0 },
      viettelpost: { total: 0, unscanned: 0 },
      ninjavan: { total: 0, unscanned: 0 },
      other: { total: 0, unscanned: 0 }
    };

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const isUnscanned = o.statusCategory === 'not_scanned';
      if (isUnscanned) stats.all.unscanned++;

      if (o.carrier === 'spx') {
        stats.spx.total++;
        if (isUnscanned) stats.spx.unscanned++;
      } else if (o.carrier === 'jt') {
        stats.jt.total++;
        if (isUnscanned) stats.jt.unscanned++;
        const clean = (o.trackingCode || '').trim().toUpperCase();
        if (clean.startsWith('530') || clean.startsWith('53')) {
          stats.jt.cargo++;
        } else {
          stats.jt.express++;
        }
      } else if (o.carrier === 'ghn') {
        stats.ghn.total++;
        if (isUnscanned) stats.ghn.unscanned++;
      } else if (o.carrier === 'viettelpost') {
        stats.viettelpost.total++;
        if (isUnscanned) stats.viettelpost.unscanned++;
      } else if (o.carrier === 'ninjavan') {
        stats.ninjavan.total++;
        if (isUnscanned) stats.ninjavan.unscanned++;
      } else {
        stats.other.total++;
        if (isUnscanned) stats.other.unscanned++;
      }
    }

    return stats;
  }, [orders]);

  const handleCopyUnscanned = async () => {
    if (unscannedOrders.length === 0) {
      onToast('Không có đơn hàng Chưa Scan nào trong danh sách!');
      return;
    }
    const success = await copyCodesToClipboard(unscannedOrders);
    if (success) {
      onToast(`Đã sao chép ${unscannedOrders.length.toLocaleString()} mã Chưa Scan vào Clipboard!`);
    }
    setShowCopyMenu(false);
  };

  const handleCopyUnscannedByAge = async (ageGroup: '1day' | '2days' | '3plus_days') => {
    const list = ageGroup === '1day' ? unscanned1Day : ageGroup === '2days' ? unscanned2Days : unscanned3PlusDays;
    const label = ageGroup === '1day' ? '1 ngày tuổi' : ageGroup === '2days' ? '2 ngày tuổi' : '≥ 3 ngày tuổi';
    if (list.length === 0) {
      onToast(`Không có đơn Chưa Scan (${label}) nào!`);
      return;
    }
    const success = await copyCodesToClipboard(list);
    if (success) {
      onToast(`Đã sao chép ${list.length.toLocaleString()} mã Chưa Scan (${label})!`);
    }
    setShowCopyMenu(false);
  };

  const handleCopyCancelled = async () => {
    const cancelled = orders.filter(o => o.statusCategory === 'cancelled');
    if (cancelled.length === 0) {
      onToast('Không có đơn Đã Hủy nào trong danh sách!');
      return;
    }
    const success = await copyCodesToClipboard(cancelled);
    if (success) {
      onToast(`Đã sao chép ${cancelled.length.toLocaleString()} mã Đã Hủy vào Clipboard!`);
    }
    setShowCopyMenu(false);
  };

  const handleCopyFiltered = async () => {
    if (filteredOrders.length === 0) {
      onToast('Danh sách hiện tại đang trống!');
      return;
    }
    const success = await copyCodesToClipboard(filteredOrders);
    if (success) {
      onToast(`Đã sao chép ${filteredOrders.length.toLocaleString()} mã đang hiển thị!`);
    }
    setShowCopyMenu(false);
  };

  const handleExportExcelAll = () => {
    exportOrdersToExcel(orders, `Bao_Cao_Tat_Ca_${orders.length}_Don.xlsx`);
    onToast(`Đã xuất báo cáo Excel cho toàn bộ ${orders.length} đơn hàng!`);
    setShowExportMenu(false);
  };

  const handleExportExcelUnscanned = () => {
    if (unscannedOrders.length === 0) {
      onToast('Không có đơn Chưa Scan nào để xuất!');
      return;
    }
    exportOrdersToExcel(unscannedOrders, `Danh_Sach_Chua_Scan_${unscannedOrders.length}_Don.xlsx`);
    onToast(`Đã xuất Excel danh sách ${unscannedOrders.length} đơn Chưa Scan!`);
    setShowExportMenu(false);
  };

  const handleExportExcelUnscanned3Days = () => {
    if (unscanned3PlusDays.length === 0) {
      onToast('Không có đơn Chưa Scan (≥ 3 ngày tuổi) nào để xuất!');
      return;
    }
    exportOrdersToExcel(unscanned3PlusDays, `Danh_Sach_Chua_Scan_Ton_Dong_3_Ngay_${unscanned3PlusDays.length}_Don.xlsx`);
    onToast(`Đã xuất Excel danh sách ${unscanned3PlusDays.length} đơn tồn đọng ≥ 3 ngày!`);
    setShowExportMenu(false);
  };

  const handleExportExcelCancelled = () => {
    const cancelled = orders.filter(o => o.statusCategory === 'cancelled');
    if (cancelled.length === 0) {
      onToast('Không có đơn Đã Hủy nào để xuất!');
      return;
    }
    exportOrdersToExcel(cancelled, `Danh_Sach_Don_Huy_${cancelled.length}_Don.xlsx`);
    onToast(`Đã xuất Excel danh sách ${cancelled.length} đơn Đã Hủy!`);
    setShowExportMenu(false);
  };

  const handleExportCSV = () => {
    exportOrdersToCSV(filteredOrders, `Danh_sach_van_don_${filteredOrders.length}.csv`);
    onToast(`Đã xuất ${filteredOrders.length} dòng dạng CSV!`);
    setShowExportMenu(false);
  };

  const handleExportJSON = () => {
    exportOrdersToJSON(orders, `Trang_Thai_Van_Don_${orders.length}_Don.json`);
    onToast(`Đã xuất file JSON lưu toàn bộ trạng thái ${orders.length} đơn hàng!`);
    setShowExportMenu(false);
  };

  const isUnscannedView = selectedStatus === 'not_scanned' || selectedStatus === 'unscanned_1day' || selectedStatus === 'unscanned_2days' || selectedStatus === 'unscanned_3days';


  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 sm:p-4 space-y-3">
      {/* Top Action Row: Run / Pause / Speed / Search / Export */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        
        {/* Left: Execution Controls with Quick Scope Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isProcessing ? (
            <button
              onClick={onPauseTracking}
              className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-lg text-amber-950 bg-amber-200 hover:bg-amber-300 border border-amber-300 transition-colors shadow-2xs cursor-pointer font-sans"
            >
              <Pause className="w-3.5 h-3.5 mr-1.5 fill-current" />
              Tạm dừng quét
            </button>
          ) : (
            <div className="inline-flex items-stretch rounded-lg shadow-2xs">
              <button
                onClick={() => onStartTracking('all')}
                className="inline-flex items-center px-4 py-2 text-xs font-bold rounded-l-lg text-white bg-slate-900 hover:bg-slate-800 active:bg-black transition-colors cursor-pointer font-sans"
              >
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current text-emerald-400" />
                Quét toàn bộ ({orders.length.toLocaleString()} đơn)
              </button>
              <button
                type="button"
                onClick={() => setShowScopeMenu(!showScopeMenu)}
                className="px-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-r-lg border-l border-slate-700 flex items-center justify-center cursor-pointer"
                title="Tùy chọn quét theo khoảng ngày"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-300" />
              </button>
            </div>
          )}

          {/* Quick Scope Presets Dropdown */}
          {showScopeMenu && !isProcessing && (
            <div className="absolute mt-12 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-40 w-64 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                Chọn khoảng ngày quét Live API
              </div>
              <button
                onClick={() => {
                  setShowScopeMenu(false);
                  onStartTracking('all');
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100 rounded-lg flex items-center justify-between"
              >
                <span>🌐 Quét toàn bộ tracking</span>
                <span className="font-mono text-[11px] text-slate-500">{orders.length}</span>
              </button>
              <button
                onClick={() => {
                  setShowScopeMenu(false);
                  onStartTracking('3days');
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-lg flex items-center justify-between"
              >
                <span>⚡ Quét 3 ngày gần nhất</span>
                <span className="font-mono text-[11px] text-emerald-600">{count3Days}</span>
              </button>
              <button
                onClick={() => {
                  setShowScopeMenu(false);
                  onStartTracking('7days');
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-lg flex items-center justify-between"
              >
                <span>⚡ Quét 7 ngày gần nhất</span>
                <span className="font-mono text-[11px] text-emerald-600">{count7Days}</span>
              </button>
              <button
                onClick={() => {
                  setShowScopeMenu(false);
                  onStartTracking('14days');
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 rounded-lg flex items-center justify-between"
              >
                <span>⚡ Quét 14 ngày gần nhất</span>
                <span className="font-mono text-[11px] text-emerald-600">{count14Days}</span>
              </button>
            </div>
          )}

          {/* Quick Date Scope Buttons on Toolbar */}
          {!isProcessing && (
            <div className="hidden sm:flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => onStartTracking('3days')}
                className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:text-emerald-900 hover:bg-white rounded-md transition-all cursor-pointer flex items-center"
                title="Chỉ quét các đơn được tạo trong 3 ngày gần nhất"
              >
                3 ngày ({count3Days})
              </button>
              <button
                onClick={() => onStartTracking('7days')}
                className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:text-emerald-900 hover:bg-white rounded-md transition-all cursor-pointer flex items-center"
                title="Chỉ quét các đơn trong 7 ngày qua"
              >
                7 ngày ({count7Days})
              </button>
              <button
                onClick={() => onStartTracking('14days')}
                className="px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:text-emerald-900 hover:bg-white rounded-md transition-all cursor-pointer flex items-center"
                title="Chỉ quét các đơn trong 14 ngày qua"
              >
                14 ngày ({count14Days})
              </button>
            </div>
          )}

          {notScannedCount > 0 && !isProcessing && (
            <button
              onClick={onRetryUnscanned}
              className="inline-flex items-center px-3.5 py-2 text-xs font-black rounded-lg text-amber-950 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 border border-amber-500 shadow-xs hover:shadow-sm transition-all cursor-pointer font-sans"
              title="Quét lại live API toàn bộ các đơn Chưa Scan để cập nhật bưu tá đã lấy hay chưa"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-amber-950 font-bold" />
              CẬP NHẬT CHƯA SCAN ({notScannedCount.toLocaleString()})
            </button>
          )}

          <button
            onClick={onRecheckAll}
            disabled={isProcessing}
            className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-50 transition-colors cursor-pointer"
            title="Quét lại từ đầu toàn bộ"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Quét lại
          </button>

          <button
            onClick={onClearAll}
            disabled={isProcessing}
            className="inline-flex items-center px-3 py-2 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-50 transition-colors cursor-pointer"
            title="Xóa toàn bộ danh sách để dán dữ liệu mới"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
            Xóa danh sách
          </button>

          {/* Concurrency Selector */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline font-semibold text-[11px] uppercase tracking-wider font-mono">Tốc độ:</span>
            <select
              value={concurrency}
              onChange={(e) => onConcurrencyChange(Number(e.target.value))}
              disabled={isProcessing}
              className="bg-transparent font-bold text-slate-900 focus:outline-hidden cursor-pointer font-mono"
              title="Số lượng đơn tra cứu ngầm cùng lúc (mỗi cụm 10 mã theo chuẩn cổng J&T Express)"
            >
              <option value={10}>10 đơn/lần (1 cụm 10 mã chuẩn J&T)</option>
              <option value={20}>20 đơn/lần (2 cụm 10 mã song song)</option>
              <option value={30}>30 đơn/lần (3 cụm 10 mã song song)</option>
              <option value={50}>50 đơn/lần (5 cụm song song - Khuyên dùng)</option>
              <option value={100}>100 đơn/lần (10 cụm siêu tốc)</option>
              <option value={200}>200 đơn/lần (20 cụm bão táp cho 10.000+ đơn)</option>
            </select>
          </div>
        </div>

        {/* Right: Quick Copy & Export Action Menus */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Quick Copy Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowCopyMenu(!showCopyMenu);
                setShowExportMenu(false);
              }}
              className="inline-flex items-center px-3 py-2 text-xs font-bold rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Sao chép mã...
            </button>

            {showCopyMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40">
                <div className="px-3.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Sao chép mã vào Clipboard
                </div>

                <button
                  onClick={handleCopyUnscanned}
                  className="w-full text-left px-3.5 py-2 text-xs text-amber-950 hover:bg-amber-50 font-bold flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-2 text-amber-600" />
                    Chép TẤT CẢ Chưa Scan ({notScannedCount})
                  </span>
                </button>

                {unscanned1Day.length > 0 && (
                  <button
                    onClick={() => handleCopyUnscannedByAge('1day')}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-emerald-900 hover:bg-emerald-50 font-medium flex items-center justify-between pl-7"
                  >
                    <span>• Chưa Scan: 1 ngày tuổi</span>
                    <span className="font-mono font-bold text-emerald-700">{unscanned1Day.length}</span>
                  </button>
                )}

                {unscanned2Days.length > 0 && (
                  <button
                    onClick={() => handleCopyUnscannedByAge('2days')}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-amber-900 hover:bg-amber-50 font-medium flex items-center justify-between pl-7"
                  >
                    <span>• Chưa Scan: 2 ngày tuổi</span>
                    <span className="font-mono font-bold text-amber-700">{unscanned2Days.length}</span>
                  </button>
                )}

                {unscanned3PlusDays.length > 0 && (
                  <button
                    onClick={() => handleCopyUnscannedByAge('3plus_days')}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-rose-950 hover:bg-rose-50 font-bold flex items-center justify-between pl-7"
                  >
                    <span>⚠️ Chưa Scan: ≥ 3 ngày tồn đọng</span>
                    <span className="font-mono font-bold text-rose-700">{unscanned3PlusDays.length}</span>
                  </button>
                )}

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={handleCopyCancelled}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-900 hover:bg-rose-50 font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <AlertOctagon className="w-3.5 h-3.5 mr-2 text-rose-600" />
                    Chép mã Đã Hủy ({cancelledCount})
                  </span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={handleCopyFiltered}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center"
                >
                  <Copy className="w-3.5 h-3.5 mr-2 text-slate-400" />
                  Chép danh sách đang lọc ({filteredOrders.length})
                </button>
              </div>
            )}
          </div>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowCopyMenu(false);
              }}
              className="inline-flex items-center px-3.5 py-2 text-xs font-bold rounded-lg text-emerald-900 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
              Xuất báo cáo
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40">
                <div className="px-3.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                  Định dạng Excel (.xlsx)
                </div>

                <button
                  onClick={handleExportExcelAll}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-800 hover:bg-slate-50 font-semibold flex items-center"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
                  Xuất toàn bộ ({orders.length} đơn)
                </button>

                <button
                  onClick={handleExportExcelUnscanned}
                  className="w-full text-left px-3.5 py-2 text-xs text-amber-900 hover:bg-amber-50 font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <Clock className="w-4 h-4 mr-2 text-amber-600" />
                    Xuất đơn CHƯA SCAN
                  </span>
                  <span className="font-mono text-[11px] text-amber-800">{notScannedCount}</span>
                </button>

                {unscanned3PlusDays.length > 0 && (
                  <button
                    onClick={handleExportExcelUnscanned3Days}
                    className="w-full text-left px-3.5 py-1.5 text-xs text-rose-950 hover:bg-rose-50 font-bold flex items-center justify-between pl-8"
                  >
                    <span className="flex items-center text-rose-900">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
                      Chỉ đơn tồn đọng ≥ 3 ngày
                    </span>
                    <span className="font-mono text-[11px] text-rose-700">{unscanned3PlusDays.length}</span>
                  </button>
                )}

                <button
                  onClick={handleExportExcelCancelled}
                  className="w-full text-left px-3.5 py-2 text-xs text-rose-900 hover:bg-rose-50 font-semibold flex items-center justify-between"
                >
                  <span className="flex items-center">
                    <AlertOctagon className="w-4 h-4 mr-2 text-rose-600" />
                    Chỉ xuất đơn ĐÃ HỦY
                  </span>
                  <span className="font-mono text-[11px] text-rose-800">{cancelledCount}</span>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={handleExportCSV}
                  className="w-full text-left px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center"
                >
                  <FileText className="w-4 h-4 mr-2 text-slate-500" />
                  Xuất file CSV ({filteredOrders.length} dòng)
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={handleExportJSON}
                  className="w-full text-left px-3.5 py-2 text-xs text-indigo-900 hover:bg-indigo-50 font-semibold flex items-center justify-between"
                  title="Tải toàn bộ trạng thái quét hiện tại dạng JSON để sao lưu hoặc khôi phục"
                >
                  <span className="flex items-center">
                    <FileCode className="w-4 h-4 mr-2 text-indigo-600" />
                    Lưu trạng thái vào file JSON
                  </span>
                  <span className="font-mono text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">.json</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 pt-2.5 border-t border-slate-100">
        
        {/* Status Filter Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onStatusChange('all')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer font-mono ${
              selectedStatus === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Tất cả ({orders.length})
          </button>

          <button
            onClick={() => onStatusChange('not_scanned')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer font-mono ${
              isUnscannedView
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3 h-3 mr-1" />
            Chưa scan ({notScannedCount})
          </button>

          <button
            onClick={() => onStatusChange('scanned')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer font-mono ${
              selectedStatus === 'scanned'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-50 text-emerald-900 border border-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Đã scan ({totalScannedCount})
          </button>

          <button
            onClick={() => onStatusChange('cancelled')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center cursor-pointer font-mono ${
              selectedStatus === 'cancelled'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-50 text-rose-900 border border-rose-300 hover:bg-rose-100'
            }`}
          >
            <AlertOctagon className="w-3 h-3 mr-1" />
            Đã hủy ({cancelledCount})
          </button>

          <button
            onClick={() => onStatusChange('in_transit')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer font-mono ${
              selectedStatus === 'in_transit'
                ? 'bg-indigo-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Đang giao ({inTransitCount})
          </button>

          <button
            onClick={() => onStatusChange('delivered')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer font-mono ${
              selectedStatus === 'delivered'
                ? 'bg-teal-700 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Thành công ({deliveredCount})
          </button>

          {errorCount > 0 && (
            <button
              onClick={() => onStatusChange('error')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer font-mono ${
                selectedStatus === 'error'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Lỗi ({errorCount})
            </button>
          )}
        </div>

        {/* Carrier Filter & Search Box */}
        <div className="flex items-center space-x-2">
          {/* Carrier selector */}
          <select
            value={selectedCarrier}
            onChange={(e) => onCarrierChange(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer font-mono"
            title="Lọc bảng theo hãng vận chuyển"
          >
            <option value="all">📦 Tất cả hãng ({orders.length.toLocaleString()})</option>
            <option value="spx">⚡ Shopee Express ({carrierStats.spx.total.toLocaleString()})</option>
            <option value="jt">🚚 J&T Express ({carrierStats.jt.total.toLocaleString()})</option>
            {carrierStats.jt.cargo > 0 && <option value="jt_cargo">📦 J&T Cargo ({carrierStats.jt.cargo.toLocaleString()})</option>}
            {carrierStats.ghn.total > 0 && <option value="ghn">GHN ({carrierStats.ghn.total.toLocaleString()})</option>}
            {carrierStats.viettelpost.total > 0 && <option value="viettelpost">Viettel Post ({carrierStats.viettelpost.total.toLocaleString()})</option>}
            {carrierStats.ninjavan.total > 0 && <option value="ninjavan">Ninja Van ({carrierStats.ninjavan.total.toLocaleString()})</option>}
            {carrierStats.other.total > 0 && <option value="other">Hãng khác ({carrierStats.other.total.toLocaleString()})</option>}
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm mã vận đơn, SĐT..."
              className="text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 w-44 sm:w-56 font-mono"
            />
          </div>
        </div>

      </div>

      {/* Dedicated Carrier Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-slate-50/90 border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-700 text-[11px] uppercase font-mono flex items-center mr-1">
            <Truck className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Lọc hãng vận chuyển:
          </span>

          {/* Tất cả hãng */}
          <button
            type="button"
            onClick={() => onCarrierChange('all')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCarrier === 'all'
                ? 'bg-slate-900 text-white shadow-2xs ring-2 ring-slate-900/30'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:border-slate-300'
            }`}
          >
            <span>Tất cả ({orders.length.toLocaleString()})</span>
            {carrierStats.all.unscanned > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCarrier === 'all' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {carrierStats.all.unscanned.toLocaleString()} chưa scan
              </span>
            )}
          </button>

          {/* Shopee Express (SPX) */}
          <button
            type="button"
            onClick={() => onCarrierChange(selectedCarrier === 'spx' ? 'all' : 'spx')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCarrier === 'spx'
                ? 'bg-[#EE4D2D] text-white shadow-2xs ring-2 ring-[#EE4D2D]/40 font-black'
                : 'bg-white text-slate-800 border border-orange-200 hover:bg-orange-50/80 hover:border-orange-300'
            }`}
            title="Lọc chỉ xem đơn Shopee Express (SPX)"
          >
            <span className={`w-2 h-2 rounded-full ${selectedCarrier === 'spx' ? 'bg-white' : 'bg-[#EE4D2D]'}`} />
            <span>Shopee Express ({carrierStats.spx.total.toLocaleString()})</span>
            {carrierStats.spx.unscanned > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCarrier === 'spx' ? 'bg-white text-[#EE4D2D] font-black' : 'bg-orange-100 text-orange-900 border border-orange-200'
              }`}>
                {carrierStats.spx.unscanned.toLocaleString()} chưa scan
              </span>
            )}
            {selectedCarrier === 'spx' && <X className="w-3 h-3 ml-0.5" />}
          </button>

          {/* J&T Express (All) */}
          <button
            type="button"
            onClick={() => onCarrierChange(selectedCarrier === 'jt' ? 'all' : 'jt')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCarrier === 'jt'
                ? 'bg-[#E60012] text-white shadow-2xs ring-2 ring-[#E60012]/40 font-black'
                : 'bg-white text-slate-800 border border-rose-200 hover:bg-rose-50/80 hover:border-rose-300'
            }`}
            title="Lọc chỉ xem đơn J&T Express & J&T Cargo"
          >
            <span className={`w-2 h-2 rounded-full ${selectedCarrier === 'jt' ? 'bg-white' : 'bg-[#E60012]'}`} />
            <span>J&T Express ({carrierStats.jt.total.toLocaleString()})</span>
            {carrierStats.jt.unscanned > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedCarrier === 'jt' ? 'bg-white text-[#E60012] font-black' : 'bg-rose-100 text-rose-900 border border-rose-200'
              }`}>
                {carrierStats.jt.unscanned.toLocaleString()} chưa scan
              </span>
            )}
            {selectedCarrier === 'jt' && <X className="w-3 h-3 ml-0.5" />}
          </button>

          {/* J&T Cargo Sub-filter if present */}
          {carrierStats.jt.cargo > 0 && (
            <button
              type="button"
              onClick={() => onCarrierChange(selectedCarrier === 'jt_cargo' ? 'all' : 'jt_cargo')}
              className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedCarrier === 'jt_cargo'
                  ? 'bg-rose-800 text-white shadow-2xs ring-2 ring-rose-800/40 font-black'
                  : 'bg-rose-50/70 text-rose-800 border border-rose-200 hover:bg-rose-100'
              }`}
              title="Lọc riêng các đơn J&T Cargo (Mã 530...)"
            >
              <span>J&T Cargo ({carrierStats.jt.cargo.toLocaleString()})</span>
              {selectedCarrier === 'jt_cargo' && <X className="w-3 h-3 ml-0.5" />}
            </button>
          )}

          {/* Giao Hàng Nhanh (GHN) */}
          {(carrierStats.ghn.total > 0 || selectedCarrier === 'ghn') && (
            <button
              type="button"
              onClick={() => onCarrierChange(selectedCarrier === 'ghn' ? 'all' : 'ghn')}
              className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCarrier === 'ghn'
                  ? 'bg-[#F26522] text-white shadow-2xs ring-2 ring-[#F26522]/40 font-black'
                  : 'bg-white text-slate-800 border border-orange-200 hover:bg-orange-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedCarrier === 'ghn' ? 'bg-white' : 'bg-[#F26522]'}`} />
              <span>GHN ({carrierStats.ghn.total.toLocaleString()})</span>
              {carrierStats.ghn.unscanned > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-200">
                  {carrierStats.ghn.unscanned} chưa scan
                </span>
              )}
              {selectedCarrier === 'ghn' && <X className="w-3 h-3 ml-0.5" />}
            </button>
          )}

          {/* Viettel Post (VTP) */}
          {(carrierStats.viettelpost.total > 0 || selectedCarrier === 'viettelpost') && (
            <button
              type="button"
              onClick={() => onCarrierChange(selectedCarrier === 'viettelpost' ? 'all' : 'viettelpost')}
              className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCarrier === 'viettelpost'
                  ? 'bg-[#EE0033] text-white shadow-2xs ring-2 ring-[#EE0033]/40 font-black'
                  : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedCarrier === 'viettelpost' ? 'bg-white' : 'bg-[#EE0033]'}`} />
              <span>Viettel Post ({carrierStats.viettelpost.total.toLocaleString()})</span>
              {selectedCarrier === 'viettelpost' && <X className="w-3 h-3 ml-0.5" />}
            </button>
          )}

          {/* Ninja Van */}
          {(carrierStats.ninjavan.total > 0 || selectedCarrier === 'ninjavan') && (
            <button
              type="button"
              onClick={() => onCarrierChange(selectedCarrier === 'ninjavan' ? 'all' : 'ninjavan')}
              className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCarrier === 'ninjavan'
                  ? 'bg-[#C41230] text-white shadow-2xs ring-2 ring-[#C41230]/40 font-black'
                  : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedCarrier === 'ninjavan' ? 'bg-white' : 'bg-[#C41230]'}`} />
              <span>Ninja Van ({carrierStats.ninjavan.total.toLocaleString()})</span>
              {selectedCarrier === 'ninjavan' && <X className="w-3 h-3 ml-0.5" />}
            </button>
          )}

          {/* Hãng khác */}
          {carrierStats.other.total > 0 && (
            <button
              type="button"
              onClick={() => onCarrierChange(selectedCarrier === 'other' ? 'all' : 'other')}
              className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCarrier === 'other'
                  ? 'bg-slate-700 text-white shadow-2xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>Khác ({carrierStats.other.total.toLocaleString()})</span>
              {selectedCarrier === 'other' && <X className="w-3 h-3 ml-0.5" />}
            </button>
          )}
        </div>

        {/* Clear filter button if filtered */}
        {selectedCarrier !== 'all' && (
          <button
            type="button"
            onClick={() => onCarrierChange('all')}
            className="text-[11px] text-slate-500 hover:text-slate-900 font-semibold underline flex items-center gap-1 cursor-pointer ml-auto"
          >
            <span>Bỏ lọc hãng</span>
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Sub-Age Filters when in Unscanned view */}
      {isUnscannedView && notScannedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-xs">
          <span className="font-bold text-amber-950 text-[11px] uppercase font-mono flex items-center">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-700" />
            Lọc theo tuổi đơn chờ scan:
          </span>

          <button
            onClick={() => onStatusChange('not_scanned')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
              selectedStatus === 'not_scanned'
                ? 'bg-amber-800 text-white shadow-2xs'
                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
            }`}
          >
            Tất cả ({notScannedCount})
          </button>

          <button
            onClick={() => onStatusChange('unscanned_1day')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center ${
              selectedStatus === 'unscanned_1day'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-white text-emerald-900 border border-emerald-300 hover:bg-emerald-50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
            1 ngày tuổi (Mới tạo): {unscanned1Day.length}
          </button>

          <button
            onClick={() => onStatusChange('unscanned_2days')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center ${
              selectedStatus === 'unscanned_2days'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'bg-white text-amber-950 border border-amber-400 hover:bg-amber-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
            2 ngày tuổi (Ưu tiên): {unscanned2Days.length}
          </button>

          <button
            onClick={() => onStatusChange('unscanned_3days')}
            className={`px-2.5 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer flex items-center ${
              selectedStatus === 'unscanned_3days'
                ? 'bg-rose-800 text-white shadow-2xs'
                : 'bg-white text-rose-950 border border-rose-400 hover:bg-rose-100'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5 animate-pulse"></span>
            ≥ 3 ngày tuổi (Tồn đọng): {unscanned3PlusDays.length}
          </button>
        </div>
      )}
    </div>
  );
};
