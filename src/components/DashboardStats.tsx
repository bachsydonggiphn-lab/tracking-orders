import React from 'react';
import { DashboardStats } from '../types';
import { Package, CheckCircle2, XCircle, Ban, RefreshCw, Truck } from 'lucide-react';

interface Props {
  stats: DashboardStats;
  onSync: () => void;
  syncInterval: number;
}

export default function DashboardStatsComponent({ stats, onSync, syncInterval }: Props) {
  const total = stats.todayOrders;
  const yesCount = stats.pickedYesCount ?? stats.carrierScannedCount;
  const noCount = stats.pickedNoCount ?? stats.waitingPickupCount;
  const cancelCount = stats.cancelledCount ?? stats.potentialMissingCount;

  const pickedPct = total > 0 ? Math.round((yesCount / total) * 100) : 0;
  const cancelPct = total > 0 ? Math.round((cancelCount / total) * 100) : 0;
  const noPct = total > 0 ? Math.round((noCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* CARD 1: Total Orders */}
      <div id="stat-card-total" className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng Đơn VN02</span>
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">{total.toLocaleString()}</span>
          <span className="text-xs text-slate-400">đơn</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          越南胡志明仓库 (VN02)
        </div>
      </div>

      {/* CARD 2: YES - Đã lấy hàng */}
      <div id="stat-card-picked-yes" className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md transition duration-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">✅ ĐÃ LẤY HÀNG</span>
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-emerald-700">{yesCount.toLocaleString()}</span>
          <span className="text-xs text-emerald-600 font-semibold">{pickedPct}%</span>
        </div>
        <div className="w-full bg-emerald-50 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pickedPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-emerald-600">Shipper đã lấy hàng khỏi kho</div>
      </div>

      {/* CARD 3: NO - Chưa lấy hàng */}
      <div id="stat-card-picked-no" className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition duration-200 ${noCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">⏳ CHƯA LẤY HÀNG</span>
          <div className={`p-2 rounded-lg ${noCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
            <Truck className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${noCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>{noCount.toLocaleString()}</span>
          <span className="text-xs text-amber-500 font-semibold">{noPct}%</span>
        </div>
        <div className="w-full bg-amber-100 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${noPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-amber-600">Đang chờ shipper đến lấy</div>
      </div>

      {/* CARD 4: CANCELLED */}
      <div id="stat-card-cancelled" className={`p-4 rounded-xl border shadow-sm hover:shadow-md transition duration-200 ${cancelCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-rose-600 uppercase tracking-wider">🚫 ĐÃ HỦY</span>
          <div className={`p-2 rounded-lg ${cancelCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-400'}`}>
            <Ban className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${cancelCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{cancelCount.toLocaleString()}</span>
          <span className="text-xs text-rose-500 font-semibold">{cancelPct}%</span>
        </div>
        <div className="w-full bg-rose-100 h-1.5 rounded-full mt-2 overflow-hidden">
          <div className="h-full rounded-full bg-rose-400 transition-all duration-700" style={{ width: `${cancelPct}%` }} />
        </div>
        <div className="mt-1 text-xs text-rose-600">Đơn bị hủy hoặc hoàn trả</div>
      </div>
    </div>
  );
}
