import React, { useState } from 'react';
import { Order, PickupStatus, CarrierType } from '../types';
import { Search, Copy, Check, Eye, AlertOctagon, RefreshCw, CheckCircle2, XCircle, Ban, Clock, Package } from 'lucide-react';

interface Props {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onSyncWMS: (full: boolean) => void;
  isSyncing: boolean;
}

const CARRIER_COLORS: Record<string, string> = {
  GHN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SPX: 'bg-orange-50 text-orange-600 border-orange-200',
  JNT: 'bg-red-50 text-red-600 border-red-200',
  BEST: 'bg-sky-50 text-sky-600 border-sky-200',
  UNKNOWN: 'bg-slate-50 text-slate-500 border-slate-200',
};

function PickupBadge({ status }: { status: PickupStatus }) {
  switch (status) {
    case 'PICKED_YES':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          ✅ ĐÃ LẤY HÀNG
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Ban className="w-3.5 h-3.5" />
          🚫 ĐÃ HỦY
        </span>
      );
    case 'PICKED_NO':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5 animate-pulse" />
          ⏳ CHƯA LẤY
        </span>
      );
  }
}

export default function TrackingList({ orders, onSelectOrder, onSyncWMS, isSyncing }: Props) {
  const [search, setSearch] = useState('');
  const [carrierFilter, setCarrierFilter] = useState<string>('ALL');
  const [pickupFilter, setPickupFilter] = useState<string>('HIDE_YES');
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, tracking: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(tracking);
    setTimeout(() => setCopiedTracking(null), 1500);
  };

  const filteredOrders = orders.filter(o => {
    const q = search.toLowerCase();
    const matchesSearch = !search ||
      o.id.toLowerCase().includes(q) ||
      o.trackingNumber.toLowerCase().includes(q) ||
      (o.seller || '').toLowerCase().includes(q);
    const matchesCarrier = carrierFilter === 'ALL' || o.carrier === carrierFilter;
    const matchesPickup = 
      pickupFilter === 'ALL' ? true : 
      pickupFilter === 'HIDE_YES' ? o.pickupStatus !== 'PICKED_YES' : 
      o.pickupStatus === pickupFilter;
    return matchesSearch && matchesCarrier && matchesPickup;
  });

  const yesCount = filteredOrders.filter(o => o.pickupStatus === 'PICKED_YES').length;
  const noCount = filteredOrders.filter(o => o.pickupStatus === 'PICKED_NO').length;
  const cancelCount = filteredOrders.filter(o => o.pickupStatus === 'CANCELLED').length;

  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
  const displayedOrders = filteredOrders.slice(0, page * itemsPerPage);

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-5 flex flex-col h-full">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">THEO DÕI ĐƠN HÀNG KHO VN02</h2>
          <p className="text-xs text-slate-500">
            越南胡志明仓库 — {filteredOrders.length.toLocaleString()} đơn
            <span className="ml-2 text-emerald-600 font-medium">✅ {yesCount.toLocaleString()}</span>
            <span className="ml-1.5 text-amber-600 font-medium">⏳ {noCount.toLocaleString()}</span>
            <span className="ml-1.5 text-rose-600 font-medium">🚫 {cancelCount.toLocaleString()}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSyncWMS(false)}
            disabled={isSyncing}
            title="Đồng bộ nhanh: Chỉ quét các trang đầu để tải đơn hàng mới"
            className={`flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs sm:text-sm transition disabled:opacity-50 shadow-sm ${isSyncing ? 'animate-pulse' : ''}`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ nhanh'}
          </button>
          <button
            onClick={() => onSyncWMS(true)}
            disabled={isSyncing}
            title="Tải toàn bộ: Tải toàn bộ đơn hàng lịch sử từ kho VN02"
            className={`flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-medium rounded-xl text-xs sm:text-sm transition disabled:opacity-50 shadow-sm`}
          >
            <Package className="w-4 h-4" />
            Tải toàn bộ
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Search */}
        <div className="relative sm:col-span-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã vận đơn, nhà bán..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 text-sm py-2 pl-9 pr-4 rounded-xl focus:outline-none transition"
          />
        </div>

        {/* Pickup Status Filter */}
        <div className="relative">
          <select
            value={pickupFilter}
            onChange={(e) => { setPickupFilter(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs py-2 px-3 rounded-xl focus:outline-none focus:border-indigo-500 appearance-none transition font-medium"
          >
            <option value="HIDE_YES">Tất cả (Ẩn đơn ĐÃ LẤY)</option>
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PICKED_YES">✅ Đã Lấy Hàng (YES)</option>
            <option value="PICKED_NO">⏳ Chưa Lấy Hàng (NO)</option>
            <option value="CANCELLED">🚫 Đã Hủy (CANCEL)</option>
          </select>
        </div>

        {/* Carrier Filter */}
        <div className="relative">
          <select
            value={carrierFilter}
            onChange={(e) => { setCarrierFilter(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs py-2 px-3 rounded-xl focus:outline-none focus:border-indigo-500 appearance-none transition"
          >
            <option value="ALL">Tất cả hãng VC</option>
            <option value="GHN">🟢 GHN (Giao Hàng Nhanh)</option>
            <option value="SPX">🟠 Shopee Express (SPX)</option>
            <option value="JNT">🔴 J&T Express</option>
            <option value="BEST">🔵 BEST Express</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="flex-1 overflow-y-auto max-h-[580px] border border-slate-100 rounded-xl relative">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <AlertOctagon className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">Không tìm thấy đơn hàng nào</p>
            <p className="text-slate-400 text-xs mt-1">Thử giảm điều kiện lọc hoặc đồng bộ WMS.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10">
                <th className="py-3 px-4">Mã Vận Đơn / ID</th>
                <th className="py-3 px-4">Hãng VC</th>
                <th className="py-3 px-4">Nhà Bán</th>
                <th className="py-3 px-4">Trạng Thái Lấy Hàng</th>
                <th className="py-3 px-4">Cập Nhật Hãng</th>
                <th className="py-3 px-4 text-center">Chi Tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayedOrders.map((order) => {
                const orderDate = new Date(order.orderDate);
                const isHighlight = order.pickupStatus === 'PICKED_NO';

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder(order)}
                    className={`hover:bg-indigo-50/30 cursor-pointer transition ${
                      isHighlight ? 'border-l-4 border-l-amber-400' :
                      order.pickupStatus === 'CANCELLED' ? 'border-l-4 border-l-rose-400 opacity-75' :
                      'border-l-4 border-l-emerald-400'
                    }`}
                  >
                    {/* Tracking + ID */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-sm">{order.trackingNumber}</span>
                        <button
                          onClick={(e) => handleCopy(e, order.trackingNumber)}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100 transition"
                          title="Sao chép mã"
                        >
                          {copiedTracking === order.trackingNumber ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {order.id} • {orderDate.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Carrier */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center font-bold text-[10px] px-2 py-0.5 rounded border ${CARRIER_COLORS[order.carrier] || CARRIER_COLORS.UNKNOWN}`}>
                        {order.carrier}
                      </span>
                    </td>

                    {/* Seller */}
                    <td className="py-3 px-4">
                      <div className="text-xs font-semibold text-slate-700 truncate max-w-[140px]" title={order.seller}>
                        {order.seller}
                      </div>
                      <div className="text-[10px] text-slate-400">{order.warehouseCode || 'VN02'}</div>
                    </td>

                    {/* Pickup Status Badge */}
                    <td className="py-3 px-4">
                      <PickupBadge status={order.pickupStatus || 'PICKED_NO'} />
                    </td>

                    {/* Latest Carrier Status */}
                    <td className="py-3 px-4">
                      {order.pickupLatestCarrierStatus ? (
                        <div>
                          <div className="text-xs text-slate-600 truncate max-w-[160px]" title={order.pickupLatestCarrierStatus}>
                            {order.pickupLatestCarrierStatus}
                          </div>
                          {order.pickupCheckedTime && (
                            <div className="text-[10px] text-slate-400">
                              {new Date(order.pickupCheckedTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Chưa kiểm tra</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onSelectOrder(order)}
                        className="text-indigo-600 hover:text-indigo-800 p-1 rounded-md hover:bg-indigo-50 transition"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        
        {/* LOAD MORE BUTTON */}
        {displayedOrders.length < filteredOrders.length && (
          <div className="p-4 border-t border-slate-100 flex justify-center">
            <button
              onClick={() => setPage(p => p + 1)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-full text-sm transition"
            >
              Hiển thị thêm (Đang xem {displayedOrders.length} / {filteredOrders.length.toLocaleString()})
            </button>
          </div>
        )}
      </div>

      {/* STATUS LEGEND */}
      <div className="mt-4 flex flex-wrap gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[10px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span><b>YES:</b> Shipper đã lấy hàng khỏi kho VN02</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span><b>NO:</b> Đang chờ shipper đến lấy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5 text-rose-500" />
          <span><b>HỦY:</b> Đơn bị hủy hoặc hoàn trả</span>
        </div>
      </div>
    </div>
  );
}
