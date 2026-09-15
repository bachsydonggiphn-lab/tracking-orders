import React from 'react';
import { 
  Zap, 
  RefreshCw, 
  Clock, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Layers,
  Sparkles,
  Truck
} from 'lucide-react';

export interface AutoSyncBarProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  intervalSeconds: number;
  onChangeInterval: (seconds: number) => void;
  countdown: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  lastAddedCount: number;
  onTriggerNow: () => void;
  onOpenSettings?: () => void;
}

export const AUTO_INTERVAL_OPTIONS = [
  { label: '10s', value: 10, desc: 'Siêu tốc' },
  { label: '20s', value: 20, desc: 'Nhanh' },
  { label: '30s', value: 30, desc: 'Mặc định' },
  { label: '1 phút', value: 60, desc: 'Tiêu chuẩn' },
  { label: '5 phút', value: 300, desc: 'Tiết kiệm' }
];

export const AutoSyncBar: React.FC<AutoSyncBarProps> = ({
  isEnabled,
  onToggle,
  intervalSeconds,
  onChangeInterval,
  countdown,
  isSyncing,
  lastSyncTime,
  lastAddedCount,
  onTriggerNow,
  onOpenSettings
}) => {
  const percentLeft = Math.max(0, Math.min(100, (countdown / intervalSeconds) * 100));

  const minutesAgo = lastSyncTime 
    ? Math.max(0, Math.floor((Date.now() - new Date(lastSyncTime).getTime()) / 60000))
    : null;

  const formatTime = (d: Date) => {
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(d));
  };

  return (
    <div className={`rounded-xl border transition-all duration-300 shadow-xs overflow-hidden ${
      isEnabled 
        ? 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/30' 
        : 'bg-white border-slate-200'
    }`}>
      {/* Top Countdown Progress Bar (Visible when enabled) */}
      {isEnabled && (
        <div className="w-full bg-emerald-950/60 h-1 overflow-hidden">
          <div 
            className="bg-emerald-400 h-full transition-all duration-1000 ease-linear shadow-xs shadow-emerald-400"
            style={{ width: `${percentLeft}%` }}
          />
        </div>
      )}

      <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
        
        {/* Left: Main Toggle & Live Badge */}
        <div className="flex items-center gap-3">
          {/* Switch Button */}
          <button
            type="button"
            onClick={() => onToggle(!isEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isEnabled ? 'bg-emerald-500 ring-2 ring-emerald-400/40' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                isEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                isEnabled ? 'text-white' : 'text-slate-900'
              }`}>
                <Zap className={`w-4 h-4 ${isEnabled ? 'text-emerald-400 fill-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                Tự Động Cập Nhật & Quét Live WMS
              </span>

              {/* Status Badge */}
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                isEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {isEnabled ? '● LIVE AUTO-PULL' : 'ĐANG TẮT'}
              </span>
            </div>

            <p className={`text-[11px] mt-0.5 ${isEnabled ? 'text-slate-300' : 'text-slate-500'}`}>
              {isEnabled ? (
                <span>
                  Đang quét thời gian thực: Cứ có đơn <strong>Shipper (Đã xuất kho)</strong> là tự kéo về & kích hoạt quét Live NVC ngay! <em>(Tự động quét bù nếu có gián đoạn)</em>
                </span>
              ) : (
                <span>
                  Đang tạm tắt: Mốc thời gian được ghi nhớ liên tục. Khi bật lại, hệ thống sẽ <strong>tự động quét bù toàn bộ thời gian đã tắt</strong> mà không bỏ sót bất kỳ đơn nào.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Center: Interval Selector (10s, 20s, 30s, 1p, 5p) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-bold mr-1 flex items-center gap-1 font-mono ${
            isEnabled ? 'text-slate-300' : 'text-slate-600'
          }`}>
            <Clock className="w-3 h-3 text-amber-500" />
            Chu kỳ:
          </span>

          {AUTO_INTERVAL_OPTIONS.map((opt) => {
            const isSelected = intervalSeconds === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChangeInterval(opt.value);
                  if (!isEnabled) onToggle(true);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  isSelected
                    ? isEnabled
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-xs ring-2 ring-emerald-400/40 font-black'
                      : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : isEnabled
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
                title={`Tự động kéo đơn và quét live mỗi ${opt.label} (${opt.desc})`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Right: Countdown, Trigger Now & Last Sync Status */}
        <div className="flex items-center gap-2.5">
          {/* Countdown / Syncing Badge */}
          {isEnabled ? (
            <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border ${
              isSyncing 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
            }`}>
              {isSyncing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                  <span>Đang kéo WMS & quét live...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Cập nhật sau: <strong className="text-white text-sm">{countdown}s</strong></span>
                </>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Chu kỳ khuyến nghị: <strong>30s</strong>
            </div>
          )}

          {/* Trigger Force Sync Button */}
          <button
            type="button"
            onClick={onTriggerNow}
            disabled={isSyncing}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
              isEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 active:scale-95'
                : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-800 active:scale-95'
            } disabled:opacity-50`}
            title="Lập tức cào đơn WMS mới nhất và quét live ngay bây giờ"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Kéo & Quét Ngay</span>
          </button>

          {/* Settings Button */}
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className={`p-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                isEnabled
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
              title="Cấu hình bộ lọc đầu mã & kho hàng YunWMS"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-bar: Last sync info & Stats */}
      {lastSyncTime && (
        <div className={`px-4 py-1.5 border-t text-[11px] flex flex-wrap items-center justify-between gap-2 ${
          isEnabled 
            ? 'bg-slate-950/80 border-slate-800 text-slate-400' 
            : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1 ${isEnabled ? 'text-slate-300' : 'text-slate-800'}`}>
              <Truck className={`w-3.5 h-3.5 ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
              Lần quét gần nhất: <strong className={isEnabled ? 'text-white' : 'text-slate-900'}>{formatTime(lastSyncTime)}</strong>
              {minutesAgo !== null && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  minutesAgo >= 2
                    ? isEnabled 
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                      : 'bg-amber-100 text-amber-900 border border-amber-200'
                    : isEnabled 
                      ? 'text-emerald-400' 
                      : 'text-slate-500'
                }`}>
                  ({minutesAgo === 0 ? 'vừa xong' : `cách đây ${minutesAgo} phút`})
                </span>
              )}
            </span>
            <span className={isEnabled ? 'text-slate-700' : 'text-slate-300'}>|</span>
            {isEnabled ? (
              <span>
                Đơn mới vừa thêm: <strong className={lastAddedCount > 0 ? 'text-emerald-400' : 'text-slate-400'}>+{lastAddedCount} đơn</strong>
              </span>
            ) : (
              <span className="text-amber-700 font-medium">
                Đã ghi nhớ mốc: Khi bật lên sẽ tự quét bù {minutesAgo ? `${minutesAgo} phút` : ''} không bỏ sót đơn!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono">
            <span className={isEnabled ? 'text-emerald-400 font-bold' : 'text-emerald-700 font-bold'}>
              🛡️ Quét bù liên tục (Gapless - Không bỏ sót)
            </span>
            <span className={isEnabled ? 'text-slate-600' : 'text-slate-300'}>•</span>
            <span className={isEnabled ? 'text-slate-400' : 'text-slate-500'}>
              Trạng thái: Shipper (Mã 8)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
