import React, { useState, useRef, useEffect } from 'react';
import { User, Monitor, Barcode, CheckCircle2, AlertCircle, Volume2, VolumeX, Flame } from 'lucide-react';
import { Order } from '../types';
import { audioSynth } from '../utils/audio';

interface Props {
  onScanComplete: (order: Order, createdNew: boolean) => void;
  enableSound: boolean;
  onToggleSound: (enabled: boolean) => void;
}

export default function ScanStation({ onScanComplete, enableSound, onToggleSound }: Props) {
  const [barcode, setBarcode] = useState('');
  const [employee, setEmployee] = useState('David');
  const [stationId, setStationId] = useState('STATION-01');
  const [loading, setLoading] = useState(false);
  const [autoFocusEnabled, setAutoFocusEnabled] = useState(true);
  
  // Scans history just for this render session
  const [sessionScans, setSessionScans] = useState<Array<{
    orderId: string;
    trackingNumber: string;
    scannedAt: string;
    isNew: boolean;
    status: string;
  }>>([]);

  const [lastScannedResult, setLastScannedResult] = useState<{
    success: boolean;
    message: string;
    order?: Order;
    isNew?: boolean;
    time?: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Trigger sound configuration change
  useEffect(() => {
    audioSynth.setEnabled(enableSound);
  }, [enableSound]);

  // Keep input focused automatically for gun scanners
  useEffect(() => {
    if (autoFocusEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocusEnabled, lastScannedResult, loading]);

  const handleInputBlur = () => {
    if (autoFocusEnabled) {
      // Re-focus after a tiny delay so it doesn't block other interactive elements completely
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 150);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          barcode: barcode.trim(),
          employeeName: employee,
          stationId: stationId
        })
      });

      if (!response.ok) {
        throw new Error("Lỗi mạng hoặc server không phản hồi");
      }

      const data = await response.json();
      if (data.success) {
        setLastScannedResult({
          success: true,
          message: data.message,
          order: data.order,
          isNew: data.created,
          time: new Date().toLocaleTimeString('vi-VN')
        });

        // Add to session scan list
        setSessionScans(prev => [
          {
            orderId: data.order.id,
            trackingNumber: data.order.trackingNumber,
            scannedAt: new Date().toLocaleTimeString('vi-VN'),
            isNew: data.created,
            status: data.order.reconciliationStatus
          },
          ...prev.slice(0, 9) // keep last 10
        ]);

        // Play high-pitch barcode beep
        if (data.created) {
          // Play warning chime since order was missing from WMS but registered anyway
          audioSynth.playNotificationChime();
        } else {
          audioSynth.playSuccessBeep();
        }

        // Notify parent to refresh list
        onScanComplete(data.order, data.created);
      } else {
        setLastScannedResult({
          success: false,
          message: data.error || "Quét thất bại!",
          time: new Date().toLocaleTimeString('vi-VN')
        });
        audioSynth.playErrorBeep();
      }
    } catch (err: any) {
      setLastScannedResult({
        success: false,
        message: err.message || "Lỗi kết nối máy quét",
        time: new Date().toLocaleTimeString('vi-VN')
      });
      audioSynth.playErrorBeep();
    } finally {
      setBarcode('');
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 flex flex-col h-full">
      {/* HEADER CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-5">
        <div className="flex items-center gap-2">
          <Barcode className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg font-bold tracking-tight">TRẠM QUÉT ĐÓNG GÓI KHO</h2>
        </div>
        
        {/* Sound Toggle */}
        <button
          onClick={() => onToggleSound(!enableSound)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition duration-200 ${
            enableSound 
              ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800 hover:bg-emerald-900/60' 
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
          title={enableSound ? "Click để tắt âm" : "Click để bật âm"}
        >
          {enableSound ? (
            <>
              <Volume2 className="w-3.5 h-3.5" />
              <span>ÂM THANH: BẬT</span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5" />
              <span>ÂM THANH: TẮT</span>
            </>
          )}
        </button>
      </div>

      {/* METADATA DROPDOWNS */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Nhân viên đóng gói
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={employee}
              onChange={(e) => setEmployee(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none transition"
            >
              <option value="David">David (Trưởng Ca)</option>
              <option value="John Smith">John Smith</option>
              <option value="Alice Nguyen">Alice Nguyen</option>
              <option value="Bob Tran">Bob Tran</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
            Máy quét / Bàn đóng
          </label>
          <div className="relative">
            <Monitor className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none transition"
            >
              <option value="STATION-01">Bàn Máy Số 01 (Quận 12)</option>
              <option value="STATION-02">Bàn Máy Số 02 (Cầu Giấy)</option>
              <option value="STATION-03">Bàn Máy Số 03 (Dự phòng)</option>
            </select>
          </div>
        </div>
      </div>

      {/* BIG BARCODE INPUT FIELD */}
      <form onSubmit={handleFormSubmit} className="mb-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onBlur={handleInputBlur}
            placeholder="Đặt con trỏ ở đây và bóp cò súng quét..."
            className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-500 text-slate-100 placeholder-slate-500 rounded-2xl py-4 px-5 text-lg font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
            disabled={loading}
            autoComplete="off"
          />
          <div className="absolute right-4 top-4 text-slate-500 flex items-center gap-2">
            <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">ENTER OK</span>
          </div>
        </div>
        
        {/* Keep focus lock notice */}
        <div className="flex items-center justify-between mt-2 px-1">
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoFocusEnabled}
              onChange={(e) => setAutoFocusEnabled(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0"
            />
            Khóa con trỏ tự động (Auto-Focus cho súng quét)
          </label>
          <span className="text-[10px] text-slate-500">
            Súng quét tự động gửi phím Enter sau khi scan
          </span>
        </div>
      </form>

      {/* SCREEN FEEDBACK DISPLAY PANEL */}
      <div className="flex-1 flex flex-col justify-center bg-slate-950 border border-slate-800 rounded-2xl p-5 mb-5 relative overflow-hidden min-h-[180px]">
        {!lastScannedResult ? (
          <div className="text-center py-6">
            <div className="mx-auto w-12 h-12 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-slate-500 mb-3">
              <Barcode className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-300">Đang chờ quét bưu kiện...</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">
              Sử dụng máy quét hoặc nhập mã (VD: GYAFDKCM, SPX551293, JNT8820, BEST8400).
            </p>
          </div>
        ) : lastScannedResult.success ? (
          <div className="flex flex-col h-full justify-between z-10 animate-fade-in">
            {/* Success visual banner */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-slate-200">
                    {lastScannedResult.isNew 
                      ? 'TẠO MỚI & THÀNH CÔNG!' 
                      : 'ĐÃ GHI NHẬN ĐÓNG GÓI!'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lastScannedResult.time} • Bàn: {lastScannedResult.order?.scanStationId}
                  </p>
                </div>
              </div>
              
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${
                lastScannedResult.isNew ? 'bg-amber-950/80 text-amber-300 border border-amber-800/50' : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
              }`}>
                {lastScannedResult.isNew ? 'Mã lạ ngoài WMS' : 'Khớp Đơn WMS'}
              </span>
            </div>

            {/* Huge barcode output */}
            <div className="my-4 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">MÃ VẬN ĐƠN</div>
              <div className="text-2xl font-black text-white font-mono tracking-wider break-all">
                {lastScannedResult.order?.trackingNumber}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-semibold">
                Mã Đơn WMS: {lastScannedResult.order?.id}
              </div>
            </div>

            {/* Bottom details */}
            <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">NHÀ BÁN:</span>
                <span className="font-semibold text-slate-200 truncate block">{lastScannedResult.order?.seller}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">ĐƠN VỊ VẬN CHUYỂN:</span>
                <span className={`font-bold block ${
                  lastScannedResult.order?.carrier === 'GHN' ? 'text-emerald-400' :
                  lastScannedResult.order?.carrier === 'SPX' ? 'text-orange-400' :
                  lastScannedResult.order?.carrier === 'JNT' ? 'text-red-400' : 'text-sky-400'
                }`}>
                  {lastScannedResult.order?.carrier === 'GHN' ? 'Giao Hàng Nhanh (GHN)' :
                   lastScannedResult.order?.carrier === 'SPX' ? 'Shopee Express (SPX)' :
                   lastScannedResult.order?.carrier === 'JNT' ? 'J&T Express (JNT)' : 'BEST Express'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center z-10 animate-fade-in">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
            <h3 className="text-base font-bold text-rose-400">QUÉT LỖI!</h3>
            <p className="text-sm text-slate-200 mt-1">{lastScannedResult.message}</p>
            <p className="text-xs text-slate-500 mt-2">{lastScannedResult.time}</p>
          </div>
        )}

        {/* Beautiful ambient visual glow */}
        {lastScannedResult && lastScannedResult.success && (
          <div className={`absolute -right-20 -bottom-20 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition duration-500 ${
            lastScannedResult.isNew ? 'bg-amber-500' : 'bg-emerald-500'
          }`} />
        )}
      </div>

      {/* SESSION SCAN LOGS */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Lịch sử ca quét hiện tại ({sessionScans.length})
          </span>
          {sessionScans.length > 0 && (
            <button 
              onClick={() => setSessionScans([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 font-semibold"
            >
              Xóa danh sách
            </button>
          )}
        </div>
        
        {sessionScans.length === 0 ? (
          <div className="text-xs text-slate-600 italic text-center py-4 border border-dashed border-slate-800 rounded-xl">
            Chưa có lượt quét nào trong ca làm việc này.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
            {sessionScans.map((scan, i) => (
              <div 
                key={i} 
                className="bg-slate-900 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between hover:bg-slate-800/60 transition"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">{scan.scannedAt}</span>
                  <span className="text-xs font-mono font-semibold text-slate-200">{scan.trackingNumber}</span>
                  {scan.isNew && (
                    <span className="bg-amber-900/40 border border-amber-800/30 text-amber-400 px-1 rounded text-[9px] font-bold">
                      Mã lạ
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                  scan.status === 'COMPLETED' 
                    ? 'bg-emerald-950/50 text-emerald-400' 
                    : 'bg-amber-950/50 text-amber-400'
                }`}>
                  {scan.status === 'COMPLETED' ? 'Completed' : 'Waiting Pickup'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
