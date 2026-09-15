import React from 'react';
import { 
  Zap, 
  RefreshCw, 
  Clock, 
  Sliders, 
  Truck,
  CheckCircle2,
  Filter
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
  // Hợp nhất đơn vị vận chuyển
  carrierScope?: string; // 'follow_filter' | 'all' | 'spx' | 'jt' | 'spx_jt' | 'vnpost' | 'best'
  currentFilterCarrier?: string; // Hãng đang chọn ở bộ lọc bảng
  onChangeCarrierScope?: (scope: string) => void;
}

export const AUTO_INTERVAL_OPTIONS = [
  { label: '10s', value: 10, desc: 'Siêu tốc' },
  { label: '20s', value: 20, desc: 'Nhanh' },
  { label: '30s', value: 30, desc: 'Mặc định' },
  { label: '1 phút', value: 60, desc: 'Tiêu chuẩn' },
  { label: '5 phút', value: 300, desc: 'Tiết kiệm' }
];

export const AUTO_SYNC_CARRIER_OPTIONS = [
  { id: 'follow_filter', label: 'Khớp bộ lọc đang xem', shortLabel: '🔄 Khớp bộ lọc', desc: 'Tự bám sát theo tab hãng đang lọc ở bảng bên dưới' },
  { id: 'all', label: 'Tất cả các hãng', shortLabel: '🌐 Tất cả', desc: 'Kéo và quét live toàn bộ mọi hãng trong kho' },
  { id: 'spx', label: 'Shopee Express (SPX)', shortLabel: '⚡ SPX', desc: 'Chỉ kéo và quét live đơn Shopee Express' },
  { id: 'jt', label: 'J&T Express & Cargo', shortLabel: '🚚 J&T', desc: 'Chỉ kéo và quét live đơn J&T Express & Cargo (Đầu 8 & 53)' },
  { id: 'spx_jt', label: 'SPX + J&T', shortLabel: '⚡SPX + 🚚J&T', desc: 'Chỉ kéo và quét 2 hãng chủ lực SPX và J&T' },
  { id: 'vnpost', label: 'VNPost / EMS', shortLabel: '📮 VNPost', desc: 'Chỉ kéo và quét live đơn Bưu điện VNPost / EMS' },
  { id: 'best', label: 'Best Express', shortLabel: '📦 Best', desc: 'Chỉ kéo và quét live đơn Best Express' }
];

export const getEffectiveCarrierInfo = (scope: string = 'follow_filter', currentFilterCarrier: string = 'all') => {
  const targetId = scope === 'follow_filter' ? currentFilterCarrier : scope;
  switch (targetId) {
    case 'spx':
      return { 
        id: 'spx', 
        name: 'Shopee Express (SPX)', 
        short: 'SPX Express', 
        badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/50', 
        icon: '⚡',
        dotColor: 'bg-orange-400'
      };
    case 'jt':
    case 'jt_cargo':
    case 'jt_express':
      return { 
        id: 'jt', 
        name: 'J&T Express & Cargo', 
        short: 'J&T Express', 
        badgeBg: 'bg-rose-500/25 text-rose-300 border-rose-500/50', 
        icon: '🚚',
        dotColor: 'bg-rose-400'
      };
    case 'spx_jt':
      return { 
        id: 'spx_jt', 
        name: 'SPX + J&T Express', 
        short: 'SPX + J&T', 
        badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/50', 
        icon: '⚡',
        dotColor: 'bg-amber-400'
      };
    case 'vnpost':
      return { 
        id: 'vnpost', 
        name: 'VNPost / EMS', 
        short: 'VNPost', 
        badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/50', 
        icon: '📮',
        dotColor: 'bg-amber-400'
      };
    case 'best':
      return { 
        id: 'best', 
        name: 'Best Express', 
        short: 'Best Express', 
        badgeBg: 'bg-red-500/25 text-red-300 border-red-500/50', 
        icon: '📦',
        dotColor: 'bg-red-400'
      };
    case 'ghn':
      return { 
        id: 'ghn', 
        name: 'Giao Hàng Nhanh (GHN)', 
        short: 'GHN', 
        badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/50', 
        icon: '🚚',
        dotColor: 'bg-orange-400'
      };
    default:
      return { 
        id: 'all', 
        name: 'Tất Cả Các Hãng', 
        short: 'Tất cả hãng', 
        badgeBg: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50', 
        icon: '🌐',
        dotColor: 'bg-emerald-400'
      };
  }
};

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
  onOpenSettings,
  carrierScope = 'follow_filter',
  currentFilterCarrier = 'all',
  onChangeCarrierScope
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

  const activeCarrier = getEffectiveCarrierInfo(carrierScope, currentFilterCarrier);

  return (
    <div className={`rounded-xl border transition-all duration-300 shadow-xs overflow-hidden ${
      isEnabled 
        ? 'bg-gradient-to-r from-emerald-950/95 via-slate-900 to-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/30' 
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

      {/* Main Bar Content */}
      <div className="p-3 sm:p-4 flex flex-col gap-3">
        
        {/* Top Row: Switch, Title, Live Status Badge & Action Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          
          {/* Left: Switch Button & Title */}
          <div className="flex items-start sm:items-center gap-3">
            {/* Switch Button */}
            <button
              type="button"
              onClick={() => onToggle(!isEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5 sm:mt-0 ${
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
              <div className="flex flex-wrap items-center gap-2">
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

                {/* Active Carrier Badge */}
                <span className={`text-[10px] font-extrabold font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 ${activeCarrier.badgeBg}`}>
                  <span>{activeCarrier.icon}</span>
                  <span>{activeCarrier.short}</span>
                  {carrierScope === 'follow_filter' && (
                    <span className="text-[9px] opacity-80">(Theo bộ lọc)</span>
                  )}
                </span>
              </div>

              <p className={`text-[11px] mt-0.5 ${isEnabled ? 'text-slate-300' : 'text-slate-500'}`}>
                {isEnabled ? (
                  <span>
                    Đang quét liên tục: Cứ có đơn <strong>Shipper (Đã xuất kho)</strong> của <strong className="text-emerald-300 underline underline-offset-2">{activeCarrier.name}</strong> là tự kéo về & kích hoạt quét Live NVC ngay! <em>(Tự động quét bù nếu có gián đoạn)</em>
                  </span>
                ) : (
                  <span>
                    Đang tạm tắt: Mốc thời gian được ghi nhớ liên tục. Khi bật lại, hệ thống sẽ <strong>tự động quét bù toàn bộ thời gian đã tắt</strong> cho <strong className="text-slate-700">{activeCarrier.name}</strong> mà không bỏ sót đơn.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Interval & Trigger Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Interval Selector */}
            <div className="flex items-center gap-1">
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
                    className={`px-2 py-0.5 rounded-md text-xs font-bold transition-all cursor-pointer border ${
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
                    <span>Đang kéo WMS & quét Live {activeCarrier.short}...</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Cập nhật sau: <strong className="text-white text-sm">{countdown}s</strong></span>
                  </>
                )}
              </div>
            ) : null}

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

        {/* Second Row: Direct Carrier Selector for Auto-Sync */}
        {onChangeCarrierScope && (
          <div className={`pt-2 pb-0.5 border-t flex flex-wrap items-center justify-between gap-2 ${
            isEnabled ? 'border-slate-800/80 text-slate-300' : 'border-slate-100 text-slate-600'
          }`}>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className={`text-[11px] font-bold font-mono flex items-center gap-1 ${
                isEnabled ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <Filter className="w-3 h-3 text-emerald-400" />
                Hãng tự động kéo & quét:
              </span>

              {AUTO_SYNC_CARRIER_OPTIONS.map((cOpt) => {
                const isSelected = carrierScope === cOpt.id;
                return (
                  <button
                    key={cOpt.id}
                    type="button"
                    onClick={() => onChangeCarrierScope(cOpt.id)}
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
                      isSelected
                        ? isEnabled
                          ? 'bg-emerald-500 text-slate-950 border-emerald-300 ring-2 ring-emerald-400/40 font-black shadow-xs'
                          : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : isEnabled
                          ? 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={cOpt.desc}
                  >
                    <span>{cOpt.shortLabel}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </button>
                );
              })}
            </div>

            <div className={`text-[10px] font-mono hidden md:block ${
              isEnabled ? 'text-slate-400' : 'text-slate-500'
            }`}>
              🎯 Mục tiêu: <strong className={isEnabled ? 'text-emerald-300' : 'text-slate-800'}>{activeCarrier.name}</strong>
            </div>
          </div>
        )}

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
              Lần quét gần nhất ({activeCarrier.short}): <strong className={isEnabled ? 'text-white' : 'text-slate-900'}>{formatTime(lastSyncTime)}</strong>
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
              Hãng: <strong className={isEnabled ? 'text-slate-200' : 'text-slate-800'}>{activeCarrier.short}</strong> (Shipper Mã 8)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
