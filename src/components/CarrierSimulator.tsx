import React, { useState } from 'react';
import { Order, CarrierType } from '../types';
import { Truck, Navigation, HelpCircle, RefreshCw, ChevronRight, Check } from 'lucide-react';

interface Props {
  orders: Order[];
  onCarrierScanned: (updatedOrder: Order) => void;
}

export default function CarrierSimulator({ orders, onCarrierScanned }: Props) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [manualTracking, setManualTracking] = useState('');
  const [submittingManual, setSubmittingManual] = useState(false);
  const [manualError, setManualError] = useState('');
  const [isLiveChecking, setIsLiveChecking] = useState(false);

  // Filter orders that are NOT yet carrier scanned (either missing or waiting pickup)
  const pendingCarrierScans = orders.filter(o => !o.carrierScanned);

  const handleLiveCheckAll = async () => {
    setIsLiveChecking(true);
    try {
      const res = await fetch('/api/check-carrier-all-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        window.location.reload(); // Refresh to show updated statuses
      }
    } catch (e) {
      console.error("Lỗi cào API live hãng:", e);
    } finally {
      setIsLiveChecking(false);
    }
  };

  const handleQuickPickup = async (order: Order) => {
    setUpdatingId(order.id);
    try {
      // First try live check from carrier API
      const liveRes = await fetch('/api/check-carrier-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          carrier: order.carrier
        })
      });
      const liveData = await liveRes.json();
      if (liveData.success && liveData.order && liveData.order.carrierScanned) {
        onCarrierScanned(liveData.order);
        setUpdatingId(null);
        return;
      }

      // Fallback to simulation if carrier API returns unpicked state
      const response = await fetch('/api/simulate-carrier-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: order.trackingNumber,
          location: getCarrierLocation(order.carrier),
          statusText: 'Đã tiếp nhận tại bưu cục'
        })
      });
      
      if (!response.ok) throw new Error("Lỗi mạng khi quét");
      const data = await response.json();
      if (data.success) {
        onCarrierScanned(data.order);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const getCarrierLocation = (carrier: CarrierType) => {
    switch (carrier) {
      case 'GHN': return 'Bưu cục GHN Cầu Giấy (donhang.ghn.vn)';
      case 'SPX': return 'Kho Phân Loại SPX Cầu Giấy';
      case 'JNT': return 'Bưu cục Khai Thác J&T Hà Nội';
      case 'BEST': return 'Kho Trung Chuyển BEST Express';
      default: return 'Bưu cục vận chuyển';
    }
  };

  const getCarrierBadgeClass = (carrier: CarrierType) => {
    switch (carrier) {
      case 'GHN': return 'bg-emerald-950 text-emerald-300 border border-emerald-800/60';
      case 'SPX': return 'bg-orange-950 text-orange-400 border border-orange-900/50';
      case 'JNT': return 'bg-red-950 text-red-400 border border-red-900/50';
      case 'BEST': return 'bg-sky-950 text-sky-300 border border-sky-800/60';
      default: return 'bg-slate-900 text-slate-300';
    }
  };

  const handleManualCarrierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTracking.trim()) return;

    setSubmittingManual(true);
    setManualError('');
    try {
      const cleanTrack = manualTracking.trim();
      const response = await fetch('/api/check-carrier-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumber: cleanTrack
        })
      });

      if (!response.ok) throw new Error("Lỗi mạng khi quét live API hãng");
      const data = await response.json();
      if (data.success && data.order) {
        onCarrierScanned(data.order);
        setManualTracking('');
      } else {
        setManualError(data.error || 'Không tìm thấy dữ liệu vận đơn từ API');
      }
    } catch (err: any) {
      setManualError(err.message || 'Lỗi kết nối');
    } finally {
      setSubmittingManual(false);
    }
  };

  return (
    <div id="carrier-sim-card" className="bg-gradient-to-br from-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-xl border border-indigo-900/60 flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-indigo-900/50 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-extrabold tracking-tight">CỔNG VẬN CHUYỂN & CÀO API HÃNG LIVE</h3>
            <p className="text-[10px] text-slate-400">GHN (donhang.ghn.vn) • SPX (spx.vn) • J&T • BEST</p>
          </div>
        </div>

        <button
          onClick={handleLiveCheckAll}
          disabled={isLiveChecking}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold py-1.5 px-3 rounded-xl transition shadow-lg disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLiveChecking ? 'animate-spin' : ''}`} />
          <span>{isLiveChecking ? 'Đang cào API...' : 'Quét API Live Hãng'}</span>
        </button>
      </div>

      <div className="text-xs text-slate-300 leading-relaxed bg-indigo-950/40 p-3 rounded-xl border border-indigo-900/40 mb-4">
        <p className="font-semibold text-indigo-300 mb-1">Mẹo thử nghiệm 4 Hãng Vận Chuyển:</p>
        <ul className="space-y-1 text-[11px] list-disc list-inside">
          <li><b>GHN:</b> Nhập mã như <code>GYAFDKCM</code> (sẽ cào API GHN từ donhang.ghn.vn).</li>
          <li><b>SPX:</b> Mã bắt đầu bằng <code>SPX...</code> hoặc <code>VN...</code>.</li>
          <li><b>J&T Express:</b> Mã bắt đầu bằng <code>88...</code> hoặc <code>JNT...</code>.</li>
          <li><b>BEST Express:</b> Mã bắt đầu bằng <code>BEST...</code> hoặc <code>84...</code>.</li>
        </ul>
      </div>

      {/* MANUAL CARRIER INPUT FORM */}
      <form onSubmit={handleManualCarrierSubmit} className="mb-4 bg-indigo-950/35 border border-indigo-900/40 p-3 rounded-xl">
        <label className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block mb-1">
          Tra cứu Live API Hãng theo Mã Vận Đơn
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="VD: GYAFDKCM (GHN), SPX..., 88..."
            value={manualTracking}
            onChange={(e) => setManualTracking(e.target.value)}
            className="flex-1 bg-slate-950 border border-indigo-900/80 focus:border-indigo-500 rounded-lg py-1 px-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submittingManual || !manualTracking.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-1 px-3 rounded-lg transition disabled:opacity-50 shrink-0 flex items-center gap-1"
          >
            {submittingManual ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Quét API'}
          </button>
        </div>
        {manualError && <p className="text-[10px] text-rose-400 mt-1 font-semibold">{manualError}</p>}
      </form>

      <div className="flex-1 overflow-y-auto max-h-[280px] space-y-2 pr-1">
        <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex justify-between items-center">
          <span>Đang chờ Hãng quét nhận ({pendingCarrierScans.length})</span>
        </div>

        {pendingCarrierScans.length === 0 ? (
          <div className="text-center py-8 text-slate-500 italic text-[11px] border border-dashed border-indigo-900/30 rounded-xl">
            Tất cả bưu kiện đã được hãng vận chuyển tiếp nhận thành công!
          </div>
        ) : (
          pendingCarrierScans.map((order) => (
            <div 
              key={order.id} 
              className="bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between transition"
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${getCarrierBadgeClass(order.carrier)}`}>
                    {order.carrier}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">{order.trackingNumber}</span>
                </div>
                
                <div className="text-[10px] text-slate-500">
                  WMS: {order.id} • {order.employeeScanned ? (
                    <span className="text-emerald-500 font-semibold">Kho đã quét</span>
                  ) : (
                    <span className="text-rose-500 font-semibold">Chưa quét đóng gói</span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleQuickPickup(order)}
                disabled={updatingId === order.id}
                className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition shrink-0 shadow-sm disabled:opacity-50"
              >
                {updatingId === order.id ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Cào API Hãng</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
