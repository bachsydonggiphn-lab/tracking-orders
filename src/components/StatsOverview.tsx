import React from 'react';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  AlertOctagon, 
  Truck, 
  CheckCheck,
  RotateCcw,
  Timer,
  Zap,
  Activity
} from 'lucide-react';
import { BatchStats, TrackingProgressMetrics } from '../types/tracking';

interface StatsOverviewProps {
  stats: BatchStats;
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
  onRetryUnscanned?: () => void;
  isProcessing: boolean;
  activeWorkers: number;
  metrics?: TrackingProgressMetrics | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({
  stats,
  selectedFilter,
  onSelectFilter,
  onRetryUnscanned,
  isProcessing,
  activeWorkers,
  metrics
}) => {
  if (stats.total === 0) return null;

  const totalScannedCount = stats.scanned + stats.inTransit + stats.delivered;

  // Compute rates out of total for consistent and accurate percentages
  const scannedRate = stats.total > 0 
    ? Math.round((totalScannedCount / stats.total) * 100)
    : 0;

  const unscannedRate = stats.total > 0
    ? Math.round((stats.notScanned / stats.total) * 100)
    : 0;

  const cancelledRate = stats.total > 0
    ? Math.round((stats.cancelled / stats.total) * 100)
    : 0;

  const cards = [
    {
      id: 'all',
      label: 'Tổng vận đơn',
      count: stats.total,
      subtext: `${stats.checked}/${stats.total} (${stats.percentComplete}%) đã kiểm tra`,
      icon: Package,
      borderColor: selectedFilter === 'all' ? 'ring-2 ring-slate-900 border-slate-900' : 'border-slate-200',
      bgClass: 'bg-white',
      badgeClass: 'bg-slate-100 text-slate-800',
    },
    {
      id: 'not_scanned',
      label: 'CHƯA SCAN (Chờ lấy)',
      count: stats.notScanned,
      subtext: `${unscannedRate}% chưa tới lấy`,
      icon: Clock,
      borderColor: selectedFilter === 'not_scanned' ? 'ring-2 ring-amber-600 border-amber-600' : 'border-amber-200',
      bgClass: 'bg-amber-50/50',
      badgeClass: 'bg-amber-100 text-amber-900 font-bold',
    },
    {
      id: 'scanned',
      label: 'ĐÃ SCAN (Đã lấy/giao)',
      count: totalScannedCount,
      subtext: `${scannedRate}% bưu cục đã nhận`,
      icon: CheckCircle2,
      borderColor: selectedFilter === 'scanned' ? 'ring-2 ring-emerald-600 border-emerald-600' : 'border-emerald-200',
      bgClass: 'bg-emerald-50/40',
      badgeClass: 'bg-emerald-100 text-emerald-900 font-bold',
    },
    {
      id: 'cancelled',
      label: 'ĐÃ HỦY (Cần giữ lại)',
      count: stats.cancelled,
      subtext: `${cancelledRate}% đơn hủy`,
      icon: AlertOctagon,
      borderColor: selectedFilter === 'cancelled' ? 'ring-2 ring-rose-600 border-rose-600' : 'border-rose-200',
      bgClass: 'bg-rose-50/50',
      badgeClass: 'bg-rose-100 text-rose-900 font-bold',
    },
    {
      id: 'in_transit',
      label: 'Đang vận chuyển',
      count: stats.inTransit,
      subtext: 'Đang luân chuyển / Giao',
      icon: Truck,
      borderColor: selectedFilter === 'in_transit' ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200',
      bgClass: 'bg-white',
      badgeClass: 'bg-indigo-50 text-indigo-800 font-semibold',
    },
    {
      id: 'delivered',
      label: 'Giao thành công',
      count: stats.delivered,
      subtext: 'Khách đã nhận hàng',
      icon: CheckCheck,
      borderColor: selectedFilter === 'delivered' ? 'ring-2 ring-teal-600 border-teal-600' : 'border-slate-200',
      bgClass: 'bg-white',
      badgeClass: 'bg-teal-50 text-teal-800 font-semibold',
    },
    ...(stats.error > 0 ? [{
      id: 'error',
      label: 'LỖI TRA CỨU',
      count: stats.error,
      subtext: 'Cần kiểm tra lại mã / SĐT',
      icon: AlertOctagon,
      borderColor: selectedFilter === 'error' ? 'ring-2 ring-red-600 border-red-600' : 'border-red-200',
      bgClass: 'bg-red-50/50',
      badgeClass: 'bg-red-100 text-red-900 font-bold',
    }] : [])
  ];

  return (
    <div className="space-y-3.5">
      {/* Progress Bar when running or completed */}
      <div className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center">
              {isProcessing && <Activity className="w-3.5 h-3.5 mr-1 text-emerald-600 animate-pulse" />}
              Tiến độ quét Live API
            </span>
            <span className="text-sm font-bold text-slate-900 font-mono">
              {isProcessing && metrics 
                ? `${metrics.completed.toLocaleString()} / ${metrics.total.toLocaleString()} (${metrics.percent}%)`
                : `${stats.checked.toLocaleString()} / ${stats.total.toLocaleString()} (${stats.percentComplete}%)`}
            </span>
            {isProcessing && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-900 text-emerald-400 border border-slate-700 animate-pulse font-mono">
                <Zap className="w-3 h-3 mr-1 text-amber-400" />
                Đang chạy song song {activeWorkers} đơn (Live API)
              </span>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
            {isProcessing && metrics && (
              <div className="flex items-center space-x-3 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-mono text-xs">
                <span className="text-emerald-950 font-bold flex items-center">
                  <Timer className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                  Dự kiến: {metrics.etaFormatted || 'Đang tính...'}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-900 font-semibold flex items-center">
                  <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  {metrics.speed.toFixed(1)} đơn/s
                </span>
              </div>
            )}

            <div className="hidden md:flex items-center space-x-3">
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 mr-1.5"></span>
                Đã lấy: <strong className="ml-1 text-emerald-800 font-mono">{scannedRate}%</strong>
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-xs bg-amber-500 mr-1.5"></span>
                Chưa lấy: <strong className="ml-1 text-amber-800 font-mono">{unscannedRate}%</strong>
              </span>
              <span className="flex items-center">
                <span className="w-2 h-2 rounded-xs bg-rose-500 mr-1.5"></span>
                Hủy: <strong className="ml-1 text-rose-800 font-mono">{cancelledRate}%</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Multi-segment visual progress bar */}
        <div className="w-full bg-slate-100 rounded-lg h-3 flex overflow-hidden border border-slate-200/80 shadow-inner">
          <div
            className="bg-emerald-500 transition-all duration-200"
            style={{ width: `${(stats.scanned / stats.total) * 100}%` }}
            title={`Đã Scan: ${stats.scanned}`}
          />
          <div
            className="bg-indigo-500 transition-all duration-200"
            style={{ width: `${(stats.inTransit / stats.total) * 100}%` }}
            title={`Đang Vận Chuyển: ${stats.inTransit}`}
          />
          <div
            className="bg-teal-500 transition-all duration-200"
            style={{ width: `${(stats.delivered / stats.total) * 100}%` }}
            title={`Giao Thành Công: ${stats.delivered}`}
          />
          <div
            className="bg-amber-500 transition-all duration-200"
            style={{ width: `${(stats.notScanned / stats.total) * 100}%` }}
            title={`Chưa Scan: ${stats.notScanned}`}
          />
          <div
            className="bg-rose-500 transition-all duration-200"
            style={{ width: `${(stats.cancelled / stats.total) * 100}%` }}
            title={`Đã Hủy: ${stats.cancelled}`}
          />
          <div
            className="bg-slate-400 transition-all duration-200"
            style={{ width: `${(stats.error / stats.total) * 100}%` }}
            title={`Lỗi / Không thấy: ${stats.error}`}
          />
        </div>
      </div>

      {/* Geometric KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedFilter === card.id || 
            (card.id === 'not_scanned' && (selectedFilter === 'unscanned_1day' || selectedFilter === 'unscanned_2days' || selectedFilter === 'unscanned_3days'));

          return (
            <button
              key={card.id}
              onClick={() => onSelectFilter(card.id)}
              className={`text-left p-3.5 rounded-xl border transition-all relative cursor-pointer hover:shadow-xs ${card.bgClass} ${card.borderColor}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className={`p-1.5 rounded-lg ${card.badgeClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-slate-200/80 px-1.5 py-0.5 rounded font-mono">
                    Đang xem
                  </span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-mono">
                {card.count.toLocaleString()}
              </div>
              <div className="text-xs font-bold text-slate-800 truncate mt-0.5">
                {card.label}
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                {card.subtext}
              </div>
              {card.id === 'not_scanned' && card.count > 0 && onRetryUnscanned && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isProcessing) {
                      onRetryUnscanned();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`mt-2 w-full inline-flex items-center justify-center px-2 py-1.5 text-[11px] font-bold rounded-lg transition-all shadow-2xs ${
                    isProcessing 
                      ? 'bg-amber-200/60 text-amber-800 cursor-not-allowed opacity-70' 
                      : 'bg-amber-400 hover:bg-amber-300 active:bg-amber-500 text-amber-950 border border-amber-500/60 cursor-pointer hover:shadow-xs'
                  }`}
                  title="Cập nhật lại trạng thái các đơn Chưa Scan này"
                >
                  <RotateCcw className="w-3 h-3 mr-1 text-amber-950 shrink-0" />
                  <span>Cập nhật lại ({card.count.toLocaleString()})</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Age Breakdown for Pending / Unscanned Orders */}
      {stats.notScanned > 0 && (
        <div className="bg-gradient-to-r from-amber-50/90 via-amber-50/60 to-orange-50/80 rounded-xl p-3.5 sm:p-4 border border-amber-200 shadow-2xs space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="p-1 rounded-md bg-amber-200/80 text-amber-900">
                <Clock className="w-4 h-4" />
              </span>
              <div>
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider font-mono">
                  Bóc tách đơn Chưa Scan theo ngày tuổi (Chờ đóng hàng / Chờ bưu tá)
                </h4>
                <p className="text-[11px] text-amber-800 font-medium">
                  Tổng <strong>{stats.notScanned.toLocaleString()}</strong> đơn hàng đang chờ kho đóng gói hoặc chờ bưu tá đến quét lấy:
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => onSelectFilter('not_scanned')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg font-mono transition-all cursor-pointer ${
                  selectedFilter === 'not_scanned'
                    ? 'bg-amber-900 text-white shadow-2xs'
                    : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                }`}
              >
                Xem tất cả Chưa Scan ({stats.notScanned})
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {/* 1 Day Old */}
            <button
              onClick={() => onSelectFilter('unscanned_1day')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                selectedFilter === 'unscanned_1day'
                  ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-500 shadow-xs'
                  : 'bg-white/90 border-emerald-200 hover:bg-emerald-50/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center text-[11px] font-bold text-emerald-900 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                  1 NGÀY TUỔI (Mới tạo)
                </span>
                <span className="font-mono font-black text-sm text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded">
                  {stats.unscanned1Day.toLocaleString()} đơn
                </span>
              </div>
              <p className="text-[11px] text-emerald-800 mt-1">
                Tạo trong ngày / 24h qua. Đang trong quy trình đóng gói & chờ bưu tá lấy ca hôm nay.
              </p>
            </button>

            {/* 2 Days Old */}
            <button
              onClick={() => onSelectFilter('unscanned_2days')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                selectedFilter === 'unscanned_2days'
                  ? 'bg-amber-100 border-amber-600 ring-2 ring-amber-600 shadow-xs'
                  : 'bg-white/90 border-amber-300 hover:bg-amber-50/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center text-[11px] font-bold text-amber-950 font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
                  2 NGÀY TUỔI (Cần ưu tiên)
                </span>
                <span className="font-mono font-black text-sm text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded">
                  {stats.unscanned2Days.toLocaleString()} đơn
                </span>
              </div>
              <p className="text-[11px] text-amber-900 mt-1">
                Tạo 24h - 48h trước. Cần ưu tiên đóng gói và giục bưu tá đến quét lấy ngay.
              </p>
            </button>

            {/* 3+ Days Old (Overdue alert) */}
            <button
              onClick={() => onSelectFilter('unscanned_3days')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${
                selectedFilter === 'unscanned_3days'
                  ? 'bg-rose-100 border-rose-600 ring-2 ring-rose-600 shadow-xs'
                  : 'bg-white/90 border-rose-300 hover:bg-rose-50/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center text-[11px] font-bold text-rose-950 font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-600 mr-1.5 animate-ping"></span>
                  ≥ 3 NGÀY TUỔI (TỒN ĐỌNG)
                </span>
                <span className="font-mono font-black text-sm text-rose-950 bg-rose-200 px-2 py-0.5 rounded">
                  {stats.unscanned3PlusDays.toLocaleString()} đơn
                </span>
              </div>
              <p className="text-[11px] text-rose-900 mt-1">
                ⚠️ Tồn đọng từ 3 ngày trở lên! Cần kiểm tra kho xem đã đóng chưa hoặc bưu cục bỏ sót đơn.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
