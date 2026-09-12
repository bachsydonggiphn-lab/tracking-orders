import React, { useState, useEffect } from 'react';
import { Truck, ExternalLink, RefreshCw, Layers, CloudDownload, Maximize, Minimize, Database } from 'lucide-react';
import { CARRIERS } from '../services/carrierDetector';

interface HeaderProps {
  totalCount: number;
  onReset: () => void;
  onOpenGuide: () => void;
  onOpenYunWMS: () => void;
  onOpenJNT10Modal?: () => void;
  onReloadDatabase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  onReset,
  onOpenGuide,
  onOpenYunWMS,
  onOpenJNT10Modal,
  onReloadDatabase
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm border border-slate-800 shrink-0">
              <Truck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-sans">
                  Tra Cứu Vận Đơn Hàng Loạt
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                  5.000+ ĐƠN/NGÀY
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kiểm tra tự động: <span className="text-emerald-700 font-semibold">Đã Scan</span>, <span className="text-amber-700 font-semibold">Chưa Scan</span>, <span className="text-rose-700 font-semibold">Đã Hủy</span> trên GHN, SPX, J&T, VTP
              </p>
            </div>
          </div>

          {/* Carrier Quick Links & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden sm:flex items-center space-x-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-400 text-[11px] uppercase tracking-wider">Hỗ trợ:</span>
              <a
                href={CARRIERS.ghn.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-orange-600 font-semibold flex items-center transition-colors text-slate-700"
                title="Giao Hàng Nhanh (Mã GY...)"
              >
                GHN <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-50" />
              </a>
              <span className="text-slate-300">|</span>
              <a
                href={CARRIERS.spx.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-red-600 font-semibold flex items-center transition-colors text-slate-700"
                title="Shopee Express (Mã SPXVN...)"
              >
                SPX <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-50" />
              </a>
              <span className="text-slate-300">|</span>
              <a
                href={CARRIERS.jt.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-rose-600 font-semibold flex items-center transition-colors text-slate-700"
                title="J&T Express (Mã 8622...)"
              >
                J&T <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-50" />
              </a>
              <span className="text-slate-300">|</span>
              <a
                href={CARRIERS.viettelpost.website}
                target="_blank"
                rel="noreferrer"
                className="hover:text-emerald-700 font-semibold flex items-center transition-colors text-slate-700"
                title="Viettel Post"
              >
                VTP <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-50" />
              </a>
            </div>

            {/* YunWMS Direct Sync Button */}
            <button
              onClick={onOpenYunWMS}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-lg text-emerald-950 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 border border-emerald-300 transition-all shadow-2xs cursor-pointer group"
              title="Kéo mã vận đơn và Order No. trực tiếp từ hệ thống WMS Cloud (Hỗ trợ Real-time Shipper không -1 ngày)"
            >
              <CloudDownload className="w-3.5 h-3.5 mr-1.5 text-emerald-700 group-hover:scale-110 transition-transform" />
              <span>⚡ Quét Real-time WMS</span>
              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-600 text-white font-mono font-black">
                LIVE
              </span>
            </button>

            {/* Reload from Database Button */}
            {onReloadDatabase && (
              <button
                onClick={onReloadDatabase}
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-indigo-950 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 transition-all shadow-2xs cursor-pointer group"
                title="Tải lại toàn bộ dữ liệu đơn hàng mới nhất trực tiếp từ SQLite Database"
              >
                <Database className="w-3.5 h-3.5 mr-1.5 text-indigo-600 group-hover:rotate-12 transition-transform" />
                Tải lại từ SQL
              </button>
            )}

            {/* Tra cứu 10 đơn J&T Express Button */}
            {onOpenJNT10Modal && (
              <button
                onClick={onOpenJNT10Modal}
                className="inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg text-rose-950 bg-rose-100 hover:bg-rose-200 active:bg-rose-300 border border-rose-300 transition-all shadow-2xs cursor-pointer group"
                title="Tra cứu 1 lần 10 đơn hàng trên J&T Express (Mở web hãng hoặc Live API)"
              >
                <span className="px-1.5 py-0.2 mr-1.5 rounded text-[10px] bg-rose-600 text-white font-mono font-black">
                  10
                </span>
                Tra cứu 10 đơn J&T
              </button>
            )}

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              title={isFullscreen ? "Thu nhỏ màn hình (Esc hoặc F11)" : "Mở toàn màn hình (F11)"}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  <span>Thu nhỏ</span>
                </>
              ) : (
                <>
                  <Maximize className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  <span>Toàn màn hình</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenGuide}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Quy tắc mã
            </button>

            {totalCount > 0 && (
              <button
                onClick={onReset}
                className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Xóa toàn bộ dữ liệu đang hiển thị để nạp lô mới"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Xóa & Làm mới
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
