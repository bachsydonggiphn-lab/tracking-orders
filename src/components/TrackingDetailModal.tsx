import React, { useState } from 'react';
import { Order, PickupStatus } from '../types';
import {
  X, Clock, CheckCircle2, AlertTriangle, Ban, ArrowRight,
  Truck, RefreshCw, ExternalLink, MapPin, Package
} from 'lucide-react';

interface Props {
  order: Order;
  onClose: () => void;
  onUpdateOrder: (updatedOrder: Order) => void;
}

function PickupStatusBanner({ status }: { status: PickupStatus }) {
  if (status === 'PICKED_YES') {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
        <div>
          <div className="font-bold text-emerald-800 text-sm">✅ SHIPPER ĐÃ LẤY HÀNG</div>
          <div className="text-xs text-emerald-600">Đơn hàng đã được hãng vận chuyển tiếp nhận và đang vận chuyển.</div>
        </div>
      </div>
    );
  }
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 mb-4">
        <Ban className="w-8 h-8 text-rose-600 shrink-0" />
        <div>
          <div className="font-bold text-rose-800 text-sm">🚫 ĐƠN ĐÃ BỊ HỦY</div>
          <div className="text-xs text-rose-600">Đơn hàng này đã bị hủy hoặc đang trong quá trình hoàn trả.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4">
      <Clock className="w-8 h-8 text-amber-600 shrink-0 animate-pulse" />
      <div>
        <div className="font-bold text-amber-800 text-sm">⏳ CHƯA LẤY HÀNG (NO)</div>
        <div className="text-xs text-amber-600">Đơn hàng đang chờ shipper đến lấy từ kho VN02.</div>
      </div>
    </div>
  );
}

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  switch (carrier) {
    case 'GHN': return `https://donhang.ghn.vn/?order_code=${trackingNumber}`;
    case 'SPX': return `https://spx.vn/track#${trackingNumber}`;
    case 'JNT': return `https://jtexpress.vn/track?billcode=${trackingNumber}`;
    case 'BEST': return `https://www.best-inc.vn/trackSearch?mailNo=${trackingNumber}`;
    default: return `https://donhang.ghn.vn/?order_code=${trackingNumber}`;
  }
}

export default function TrackingDetailModal({ order, onClose, onUpdateOrder }: Props) {
  const [isCheckingLive, setIsCheckingLive] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const [manualStatus, setManualStatus] = useState<PickupStatus | ''>('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  const handleLiveCheck = async () => {
    setIsCheckingLive(true);
    setLiveMessage('');
    try {
      const res = await fetch('/api/check-carrier-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber: order.trackingNumber, carrier: order.carrier }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.order) onUpdateOrder(data.order);
        const result = data.result || data.fetchResult;
        if (result) {
          setLiveMessage(result.pickedUp ? `✅ Đã lấy hàng: ${result.latestStatus}` : result.cancelled ? `🚫 Đơn bị hủy: ${result.latestStatus}` : `⏳ Chưa lấy: ${result.latestStatus || 'Chờ hãng cập nhật'}`);
        }
      }
    } catch (e) {
      setLiveMessage('Lỗi kết nối API hãng vận chuyển.');
    } finally {
      setIsCheckingLive(false);
    }
  };

  const handleManualStatusSave = async () => {
    if (!manualStatus) return;
    setIsSavingManual(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/pickup-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupStatus: manualStatus }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        onUpdateOrder(data.order);
        setManualStatus('');
      }
    } catch (e) { /* ignore */ } finally {
      setIsSavingManual(false);
    }
  };

  const pickupStatus: PickupStatus = order.pickupStatus || (order.carrierScanned ? 'PICKED_YES' : 'PICKED_NO');
  const orderDate = new Date(order.orderDate);
  const ageHours = Math.round(((Date.now() - orderDate.getTime()) / 3600000) * 10) / 10;
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto relative overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                order.carrier === 'GHN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                order.carrier === 'SPX' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                order.carrier === 'JNT' ? 'bg-red-50 text-red-600 border-red-200' :
                order.carrier === 'BEST' ? 'bg-sky-50 text-sky-600 border-sky-200' :
                'bg-slate-50 text-slate-600 border-slate-200'
              }`}>
                {order.carrier === 'GHN' ? 'GIAO HÀNG NHANH (GHN)' :
                 order.carrier === 'SPX' ? 'SHOPEE EXPRESS (SPX)' :
                 order.carrier === 'JNT' ? 'J&T EXPRESS' :
                 order.carrier === 'BEST' ? 'BEST EXPRESS' : order.carrier}
              </span>
              <span className="text-xs text-slate-400">WMS: {order.id}</span>
            </div>
            <h2 className="text-xl font-bold font-mono text-slate-900 mt-1">{order.trackingNumber}</h2>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {/* Live tracking button */}
            <button
              onClick={handleLiveCheck}
              disabled={isCheckingLive}
              className={`flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition disabled:opacity-50 ${isCheckingLive ? 'animate-pulse' : ''}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingLive ? 'animate-spin' : ''}`} />
              {isCheckingLive ? 'Đang cào...' : 'Cào API Live'}
            </button>
            {/* Link to carrier website */}
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Tra cứu web
            </a>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[75vh]">
          {/* Status Banner */}
          <PickupStatusBanner status={pickupStatus} />

          {/* Live check result */}
          {liveMessage && (
            <div className={`text-sm px-3 py-2 rounded-lg mb-4 font-medium ${
              liveMessage.startsWith('✅') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              liveMessage.startsWith('🚫') ? 'bg-rose-50 text-rose-700 border border-rose-200' :
              liveMessage.startsWith('⏳') ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-slate-50 text-slate-600 border border-slate-200'
            }`}>
              {liveMessage}
            </div>
          )}

          {/* Order Info */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Nhà Bán</div>
              <div className="text-sm font-semibold text-slate-800">{order.seller}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Kho</div>
              <div className="text-sm font-semibold text-slate-800">{order.warehouseCode || 'VN02'} — {order.warehouse}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Ngày Tạo Đơn</div>
              <div className="text-sm font-semibold text-slate-800">{orderDate.toLocaleString('vi-VN')}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1">Tuổi Đơn</div>
              <div className="text-sm font-semibold text-slate-800">{ageHours} giờ trước</div>
            </div>
          </div>

          {/* Carrier tracking info */}
          {(order.pickupLatestCarrierStatus || order.carrierLatestStatus) && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
              <div className="text-xs font-bold text-blue-700 uppercase mb-2 flex items-center gap-1.5">
                <Truck className="w-4 h-4" />
                Thông Tin Hãng Vận Chuyển
              </div>
              <div className="text-sm text-blue-800 font-semibold">
                {order.pickupLatestCarrierStatus || order.carrierLatestStatus}
              </div>
              {(order.pickupLocation || order.carrierCurrentLocation) && (
                <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                  <MapPin className="w-3 h-3" />
                  {order.pickupLocation || order.carrierCurrentLocation}
                </div>
              )}
              {order.pickupCheckedTime && (
                <div className="text-[10px] text-blue-400 mt-1">
                  Cập nhật: {new Date(order.pickupCheckedTime).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          )}

          {/* Carrier History */}
          {order.carrierScanHistory && order.carrierScanHistory.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Lịch Sử Vận Chuyển
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {order.carrierScanHistory.map((log, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="w-1 bg-indigo-200 rounded-full shrink-0 mt-1" />
                    <div>
                      <div className="font-semibold text-slate-700">{log.description}</div>
                      <div className="text-slate-400">{log.location} • {new Date(log.timestamp).toLocaleString('vi-VN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Status Override */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <div className="text-xs font-bold text-slate-500 uppercase mb-2">Cập Nhật Trạng Thái Thủ Công</div>
            <div className="flex gap-2 items-center">
              <select
                value={manualStatus}
                onChange={(e) => setManualStatus(e.target.value as PickupStatus)}
                className="flex-1 bg-slate-50 border border-slate-200 text-sm py-2 px-3 rounded-xl focus:outline-none focus:border-indigo-500 appearance-none"
              >
                <option value="">Chọn trạng thái...</option>
                <option value="PICKED_YES">✅ ĐÃ LẤY HÀNG (YES)</option>
                <option value="PICKED_NO">⏳ CHƯA LẤY HÀNG (NO)</option>
                <option value="CANCELLED">🚫 ĐÃ HỦY</option>
              </select>
              <button
                onClick={handleManualStatusSave}
                disabled={!manualStatus || isSavingManual}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition disabled:opacity-50"
              >
                {isSavingManual ? 'Lưu...' : 'Lưu'}
              </button>
            </div>
          </div>

          {/* Products */}
          {order.products && order.products.length > 0 && (
            <div className="border-t border-slate-100 pt-4 mt-4">
              <div className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" />
                Sản Phẩm ({order.products.length})
              </div>
              <div className="space-y-1.5">
                {order.products.map((p, i) => (
                  <div key={i} className="flex justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                    <span className="font-mono text-slate-600">{p.barcode}</span>
                    <span className="font-bold text-slate-700">x{p.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-xl transition"
          >
            <ExternalLink className="w-4 h-4" />
            Mở Trang Tra Cứu {order.carrier}
            <ArrowRight className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl transition"
          >
            Đóng Lại
          </button>
        </div>
      </div>
    </div>
  );
}
