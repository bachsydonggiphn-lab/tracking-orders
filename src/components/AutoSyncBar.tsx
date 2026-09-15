import React from 'react';
import { 
  Zap, 
  RefreshCw, 
  Clock, 
  Sliders, 
  Truck,
  CheckCircle2,
  Filter,
  CloudDownload,
  Check
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
  selectedCarrier: string; // 'all' | 'spx' | 'jt' | 'jt_cargo' | 'spx_jt' | 'vnpost' | 'best' ...
  onSelectCarrier: (carrier: string) => void;
}

export const AUTO_INTERVAL_OPTIONS = [
  { label: '10s', value: 10, desc: 'Siêu tốc' },
  { label: '20s', value: 20, desc: 'Nhanh' },
  { label: '30s', value: 30, desc: 'Mặc định' },
  { label: '1 phút', value: 60, desc: 'Tiêu chuẩn' },
  { label: '5 phút', value: 300, desc: 'Tiết kiệm' }
];

export const UNIFIED_CARRIER_OPTIONS = [
  { 
    id: 'all', 
    name: 'Tất cả các hãng', 
    shortLabel: '🌐 Tất cả hãng', 
    desc: 'Đồng bộ & quét toàn bộ các hãng kho YunWMS',
    colorClass: 'bg-slate-800 text-white'
  },
  { 
    id: 'spx', 
    name: 'Shopee Express (SPX)', 
    shortLabel: '⚡ SPX Shopee', 
    desc: 'Chỉ đồng bộ & quét đơn Shopee Express (SPXVN...)',
    colorClass: 'bg-[#EE4D2D] text-white'
  },
  { 
    id: 'jt', 
    name: 'J&T Express (Đầu 8 & 53)', 
    shortLabel: '🚚 J&T (Đầu 8 & 53)', 
    desc: 'Chỉ đồng bộ & quét đơn J&T Express & J&T Cargo',
    colorClass: 'bg-[#E60012] text-white'
  },
  { 
    id: 'spx_jt', 
    name: 'SPX + J&T (Chủ lực kho)', 
    shortLabel: '⚡ SPX + 🚚 J&T', 
    desc: 'Đồng bộ 2 hãng chủ lực SPX và J&T',
    colorClass: 'bg-amber-500 text-slate-950'
  },
  { 
    id: 'vnpost', 
    name: 'VNPost / EMS', 
    shortLabel: '📮 VNPost / EMS', 
    desc: 'Chỉ đồng bộ & quét đơn Bưu điện VNPost / EMS',
    colorClass: 'bg-amber-600 text-white'
  },
  { 
    id: 'best', 
    name: 'Best Express', 
    shortLabel: '📦 Best Express', 
    desc: 'Chỉ đồng bộ & quét đơn Best Express (BEST, 61..., 81...)',
    colorClass: 'bg-red-700 text-white'
  }
];

export const getEffectiveCarrierInfo = (targetId: string = 'all') => {
  switch (targetId) {
    case 'spx':
      return { 
        id: 'spx', 
        name: 'Shopee Express (SPX)', 
        short: 'SPX Express', 
        badgeBg: 'bg-[#EE4D2D]/20 text-[#EE4D2D] border-[#EE4D2D]/40', 
        activeBg: 'bg-[#EE4D2D] text-white shadow-xs',
        icon: '⚡',
        desc: 'Mã SPXVN, SPX (~66% kho)'
      };
    case 'jt':
    case 'jt_cargo':
    case 'jt_express':
      return { 
        id: 'jt', 
        name: 'J&T Express & Cargo', 
        short: 'J&T Express', 
        badgeBg: 'bg-[#E60012]/20 text-rose-300 border-rose-500/40', 
        activeBg: 'bg-[#E60012] text-white shadow-xs',
        icon: '🚚',
        desc: 'Mã 12 số bắt đầu bằng 8 hoặc 53'
      };
    case 'spx_jt':
      return { 
        id: 'spx_jt', 
        name: 'SPX + J&T Express', 
        short: 'SPX + J&T', 
        badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/50', 
        activeBg: 'bg-amber-500 text-slate-950 font-black shadow-xs',
        icon: '⚡',
        desc: 'Hai hãng chủ lực chiếm >85% đơn'
      };
    case 'vnpost':
      return { 
        id: 'vnpost', 
        name: 'VNPost / EMS', 
        short: 'VNPost', 
        badgeBg: 'bg-amber-500/25 text-amber-300 border-amber-500/50', 
        activeBg: 'bg-amber-600 text-white shadow-xs',
        icon: '📮',
        desc: 'Mã EA/EB...VN, VNPOST, EMS'
      };
    case 'best':
      return { 
        id: 'best', 
        name: 'Best Express', 
        short: 'Best Express', 
        badgeBg: 'bg-red-500/25 text-red-300 border-red-500/50', 
        activeBg: 'bg-red-700 text-white shadow-xs',
        icon: '📦',
        desc: 'Mã BEST, 61..., 81...'
      };
    default:
      return { 
        id: 'all', 
        name: 'Tất Cả Các Hãng', 
        short: 'Tất cả hãng', 
        badgeBg: 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50', 
        activeBg: 'bg-emerald-500 text-slate-950 font-black shadow-xs',
        icon: '🌐',
        desc: 'Toàn bộ 100% đơn kho YunWMS'
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
  selectedCarrier,
  onSelectCarrier
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

  const activeCarrier = getEffectiveCarrierInfo(selectedCarrier);

  return (
    <div className={`rounded-xl border transition-all duration-300 shadow-xs overflow-hidden ${
      isEnabled 
        ? 'bg-gradient-to-r from-emerald-950/95 via-slate-900 to-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/30' 
        : 'bg-white border-slate-200'
    }`}>
      {/* Top Countdown Progress Bar (Visible when auto sync is enabled) */}
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
        
        {/* Top Row: Title (Exact user request wording), Live Badge & Action Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          
          {/* Left: Cloud Icon + Title "Đồng Bộ & Quét Dữ Liệu YunWMS - LIVE API" */}
          <div className="flex items-start sm:items-center gap-3">
            {/* Auto-Sync Toggle Switch */}
            <button
              type="button"
              onClick={() => onToggle(!isEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-0.5 sm:mt-0 ${
                isEnabled ? 'bg-emerald-500 ring-2 ring-emerald-400/40' : 'bg-slate-300'
              }`}
              title={isEnabled ? 'Bấm để tạm dừng tự động quét định kỳ' : 'Bấm để bật tự động quét WMS định kỳ'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>

            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              isEnabled 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}>
              <CloudDownload className="w-4 h-4" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-black uppercase tracking-wider font-mono flex items-center gap-1.5 ${
                  isEnabled ? 'text-white' : 'text-slate-900'
                }`}>
                  Đồng Bộ & Quét Dữ Liệu YunWMS
                </span>

                {/* LIVE API Badge */}
                <span className="px-1.5 py-0.2 rounded text-[10px] font-black font-mono bg-emerald-500 text-slate-950 shadow-xs uppercase">
                  LIVE API
                </span>

                {/* Status Badge */}
                <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  isEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {isEnabled ? '● TỰ ĐỘNG BẬT' : 'ĐANG TẮT'}
                </span>

                {/* Current Target Carrier Badge */}
                <span className={`text-[10px] font-extrabold font-mono px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${activeCarrier.badgeBg}`}>
                  <span>{activeCarrier.icon}</span>
                  <span>{activeCarrier.name}</span>
                </span>
              </div>

              <p className={`text-[11px] mt-0.5 ${isEnabled ? 'text-slate-300' : 'text-slate-500'}`}>
                <span>
                  Kéo Order No., RefNo., và Tracking No. trực tiếp từ hệ thống WMS Cloud •{' '}
                  {isEnabled ? (
                    <strong className="text-emerald-300">
                      Đang đồng bộ thời gian thực {activeCarrier.name} (Shipper - Đã xuất kho) & quét Live NVC ngay!
                    </strong>
                  ) : (
                    <span>
                      Sẵn sàng đồng bộ cho <strong>{activeCarrier.name}</strong>. Bật tự động hoặc bấm Kéo & Quét Ngay!
                    </span>
                  )}
                </span>
              </p>
            </div>
          </div>

          {/* Right: Interval Selector & Action Buttons */}
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
            {isEnabled && (
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
              title={`Lập tức kéo đơn ${activeCarrier.name} mới nhất từ YunWMS và quét live ngay`}
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
                title="Cấu hình tài khoản & từ điển đầu mã YunWMS"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Second Row: HÃNG ĐANG ĐỒNG BỘ & BỘ CHỌN HÃNG TRỰC TIẾP */}
        <div className={`pt-2.5 pb-0.5 border-t flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 ${
          isEnabled ? 'border-slate-800/80 text-slate-300' : 'border-slate-100 text-slate-600'
        }`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] font-bold font-mono flex items-center gap-1 mr-1 ${
              isEnabled ? 'text-slate-300' : 'text-slate-700'
            }`}>
              <Filter className="w-3 h-3 text-emerald-400" />
              Chọn hãng muốn kéo về & quét:
            </span>

            {UNIFIED_CARRIER_OPTIONS.map((cOpt) => {
              const isSelected = selectedCarrier === cOpt.id || 
                (cOpt.id === 'jt' && (selectedCarrier === 'jt_cargo' || selectedCarrier === 'jt_express'));
              return (
                <button
                  key={cOpt.id}
                  type="button"
                  onClick={() => onSelectCarrier(cOpt.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                    isSelected
                      ? isEnabled
                        ? `${cOpt.colorClass} shadow-xs ring-2 ring-white/30 font-black border-transparent`
                        : `${cOpt.colorClass} shadow-xs border-transparent font-black`
                      : isEnabled
                        ? 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={cOpt.desc}
                >
                  <span>{cOpt.shortLabel}</span>
                  {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>

          <div className={`text-[11px] font-mono flex items-center gap-1.5 ${
            isEnabled ? 'text-slate-400' : 'text-slate-500'
          }`}>
            <span>🎯 Hãng đang chọn:</span>
            <strong className={`px-2 py-0.5 rounded text-[11px] ${
              isEnabled ? 'bg-slate-800 text-emerald-300 border border-slate-700' : 'bg-slate-100 text-slate-900 border border-slate-200'
            }`}>
              {activeCarrier.name}
            </strong>
          </div>
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
              Lần đồng bộ gần nhất ({activeCarrier.short}): <strong className={isEnabled ? 'text-white' : 'text-slate-900'}>{formatTime(lastSyncTime)}</strong>
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
              Hãng mục tiêu: <strong className={isEnabled ? 'text-slate-200' : 'text-slate-800'}>{activeCarrier.short}</strong> (Shipper Mã 8)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
