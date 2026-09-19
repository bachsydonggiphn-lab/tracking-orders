import React, { useState, useRef, useEffect } from 'react';
import { 
  CloudDownload, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Server, 
  Key, 
  User, 
  Layers, 
  ArrowRight, 
  RefreshCw,
  Database,
  Filter,
  Check,
  Zap,
  Globe,
  Sliders,
  Clock,
  Sparkles,
  StopCircle,
  Timer,
  Activity,
  Calendar,
  Target,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Plus,
  Tag,
  CheckSquare,
  Square,
  Info
} from 'lucide-react';
import { OrderItem } from '../types/tracking';
import { 
  detectCarrier, 
  getDirectTrackingUrl, 
  CARRIERS, 
  HISTORICAL_CARRIER_PREFIXES, 
  matchesTrackingPrefixFilter, 
  HistoricalCarrierDefinition 
} from '../services/carrierDetector';

interface YunWMSSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete: (syncedOrders: OrderItem[], autoTrack: boolean, appendMode: boolean) => void;
  onToast: (msg: string) => void;
}

export const YunWMSSyncModal: React.FC<YunWMSSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  onToast
}) => {
  const [wmsUrl] = useState('https://czwh.wms.yunwms.com/');
  const [userName, setUserName] = useState('David');
  const [userPass, setUserPass] = useState('12345abc');
  const [limit, setLimit] = useState<number>(0); // Default to 0 = Toàn bộ đơn không giới hạn
  const [warehouseId, setWarehouseId] = useState<string>('7'); // Default to 7: VN02 [越南胡志明仓库]
  const [dateInterval, setDateInterval] = useState<string>(''); // Default to exact date selection
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [isCustomDate, setIsCustomDate] = useState<boolean>(true); // Default to true so dateFor and dateTo are active
  const [customDateFor, setCustomDateFor] = useState<string>(todayStr); // Default to today in real-time
  const [customDateTo, setCustomDateTo] = useState<string>(todayStr);
  const [searchDateType, setSearchDateType] = useState<string>('createDate'); // createDate, printTime, packTime, shipTime, syncWmsTime
  const [customerCode, setCustomerCode] = useState<string>(''); // YD or all
  const [orderStatus, setOrderStatus] = useState<string>('8'); // Mặc định Mã 8 (Shipped / Đã xuất kho) khớp 100% số lượng 1.453 đơn WMS
  const [threads, setThreads] = useState<number>(20); // Multi-threading concurrency (default 20 workers)
  const [autoTrack, setAutoTrack] = useState<boolean>(true);
  const [appendMode, setAppendMode] = useState<boolean>(false); // Mặc định false để tải đơn mới nhất thay vì gộp đè đơn cũ

  // Carrier filter: Mặc định 'all' (Toàn bộ đơn kho 100%) để không bỏ sót bất kỳ đơn nào khớp WMS
  const [only8623AndSpxvn, setOnly8623AndSpxvn] = useState<boolean>(false);
  const [excludeToday, setExcludeToday] = useState<boolean>(false); // ⚡ Mặc định Thời Gian Thực: Không trừ 1 ngày!
  const [carrierFilterMode, setCarrierFilterMode] = useState<'spx_jt' | 'all' | 'custom'>('all');
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>(['spx', 'jt', 'vnpost', 'best']);
  const [customPrefixes, setCustomPrefixes] = useState<string[]>([]);
  const [customPrefixInput, setCustomPrefixInput] = useState<string>('');
  const [showPrefixDictionary, setShowPrefixDictionary] = useState<boolean>(false);

  const handleToggleRealtime = (enableRealtime: boolean) => {
    setExcludeToday(!enableRealtime);
  };

  const handleToggleCarrier = (id: string) => {
    if (selectedCarriers.includes(id)) {
      if (selectedCarriers.length === 1 && customPrefixes.length === 0) {
        onToast('Cần chọn ít nhất 1 hãng hoặc nhập 1 tiền tố tùy chỉnh!');
        return;
      }
      setSelectedCarriers(selectedCarriers.filter(c => c !== id));
    } else {
      setSelectedCarriers([...selectedCarriers, id]);
    }
  };

  const handleAddCustomPrefix = () => {
    const raw = customPrefixInput.trim().toUpperCase();
    if (!raw) return;
    const parts = raw.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
    const updated = [...customPrefixes];
    for (const part of parts) {
      if (!updated.includes(part)) {
        updated.push(part);
      }
    }
    setCustomPrefixes(updated);
    setCustomPrefixInput('');
  };

  const handleRemoveCustomPrefix = (pfx: string) => {
    setCustomPrefixes(customPrefixes.filter(p => p !== pfx));
  };

  // Sync Progress & ETA state
  const [isLoading, setIsLoading] = useState(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [targetCount, setTargetCount] = useState<number>(0);
  const [etaText, setEtaText] = useState<string>('');
  const [speedText, setSpeedText] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [activeThreadsCount, setActiveThreadsCount] = useState<number>(20);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');
  const [totalWmsCount, setTotalWmsCount] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isStoppingRef = useRef<boolean>(false);
  const accumulatedOrdersRef = useRef<any[]>([]);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      isStoppingRef.current = true;
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestSuccess(null);
    setTestMessage('');
    try {
      const res = await fetch('/api/yunwms/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName, userPass })
      });
      const data = await res.json();
      if (data.success) {
        setTestSuccess(true);
        setTestMessage('Kết nối API YunWMS thành công! Phiên đăng nhập hợp lệ.');
      } else {
        setTestSuccess(false);
        setTestMessage(data.error || 'Đăng nhập không thành công');
      }
    } catch (err: any) {
      setTestSuccess(false);
      setTestMessage(err.message || 'Lỗi mạng hoặc kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopAndUseLoaded = () => {
    isStoppingRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const convertRawToOrderItems = (rawOrders: any[]): OrderItem[] => {
    // Current VN GMT+7 date formatting for strict client-side validation
    const now = new Date();
    const vnFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr4 = vnFormatter.format(now);
    const todayStr2 = todayStr4.substring(2);

    const filtered = rawOrders.filter((item: any) => {
      const trackingCode = (item.trackingNumber || item.orderNo || '').trim().toUpperCase();

      // 1. Lọc theo đầu mã vận đơn
      const isMatchedPrefix = matchesTrackingPrefixFilter(trackingCode, {
        carrierFilterMode,
        selectedCarriers,
        customPrefixes,
        only8623AndSpxvn: carrierFilterMode === 'spx_jt'
      });
      if (!isMatchedPrefix) return false;

      // 2. Chỉ kéo trạng thái shipper -1 ngày (khi dùng preset excludeToday và không phải chọn ngày tùy chọn)
      if (excludeToday && !isCustomDate) {
        const orderDate = (item.createDate || '').trim();
        if (orderDate.startsWith(todayStr4) || orderDate.startsWith(todayStr2)) return false;
      }

      return true;
    });

    return filtered.map((item: any, idx: number) => {
      const trackingCode = (item.trackingNumber || item.orderNo || '').trim();
      const wmsWarehouseName = item.warehouseName || (item.warehouseId === '7' ? 'VN02 [Kho Hồ Chí Minh]' : item.warehouseId === '4' ? 'VN01 [Kho VN01 Hải Ngoại]' : 'WMS');
      const detectedCarrier = detectCarrier(trackingCode, item.carrierChannel);
      const carrierInfo = CARRIERS[detectedCarrier] || CARRIERS.unknown;

      const isCancelled = item.wmsStatusCode === '0' || 
                          item.wmsStatusCode === '14' || 
                          (item.wmsStatus && (
                            item.wmsStatus.includes('xóa') || 
                            item.wmsStatus.includes('hủy') || 
                            item.wmsStatus.includes('huỷ') || 
                            item.wmsStatus.includes('cắt đơn')
                          ));

      return {
        id: `wms-${item.orderNo || idx}-${trackingCode}`,
        trackingCode: trackingCode || item.orderNo,
        carrier: detectedCarrier,
        statusCategory: isCancelled ? 'cancelled' : 'not_scanned',
        rawStatusText: isCancelled 
          ? `Đã hủy trên WMS (${item.wmsStatus || 'Đã xóa'})` 
          : item.trackingNumber 
            ? `Chờ ${carrierInfo.shortName} lấy hàng (Chưa scan)` 
            : 'Chưa có mã vận đơn',
        statusDetail: isCancelled
          ? `Kho: ${wmsWarehouseName} | Đơn bị xóa / hủy trên Shopee hoặc WMS (Mã: ${item.wmsStatusCode || '0'})`
          : `Kho: ${wmsWarehouseName} | WMS: ${item.wmsStatus || 'Đã nộp'} | Kênh: ${item.carrierChannel || 'WMS'}`,
        timeline: isCancelled ? [
          {
            time: item.createDate || '',
            statusText: `Đơn hàng đã bị hủy / xóa trên hệ thống WMS (${item.wmsStatus || 'Đã xóa'})`,
            location: wmsWarehouseName,
            description: `Mã trạng thái WMS: ${item.wmsStatusCode || '0'}`
          }
        ] : [],
        isChecking: false,
        directUrl: getDirectTrackingUrl(detectedCarrier, trackingCode),
        originalRowIndex: idx + 1,
        orderNo: item.orderNo,
        refNo: item.refNo,
        customerCode: item.customerCode,
        warehouseId: item.warehouseId || warehouseId,
        warehouseName: wmsWarehouseName,
        platformOrderNo: item.platformOrderNo,
        carrierChannel: item.carrierChannel,
        wmsStatus: item.wmsStatus,
        source: 'yunwms',
        extraInfo: {
          shopName: item.customerCode ? `Khách: ${item.customerCode}` : wmsWarehouseName,
          orderDate: (searchDateType === 'shipTime' && item.shipTime) 
            ? item.shipTime 
            : (searchDateType === 'printTime' && item.printTime) 
            ? item.printTime 
            : (searchDateType === 'packTime' && item.packTime) 
            ? item.packTime 
            : (searchDateType === 'syncWmsTime' && item.syncWmsTime) 
            ? item.syncWmsTime 
            : (item.createDate || item.shipTime || item.packTime || item.printTime),
          createDate: item.createDate,
          shipTime: item.shipTime,
          packTime: item.packTime,
          printTime: item.printTime,
          syncWmsTime: item.syncWmsTime,
          platform: item.carrierChannel || 'WMS'
        }
      };
    });
  };

  const getDateRangeDescription = (): string => {
    const now = new Date();
    const vnFormatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit'
    });
    const currentTimeStr = timeFormatter.format(now);
    const oneDayMs = 24 * 60 * 60 * 1000;
    const yesterdayDate = new Date(now.getTime() - oneDayMs);
    const yesterdayStr = vnFormatter.format(yesterdayDate);
    const todayStr = vnFormatter.format(now);
    const dateTypeNote = `[${searchDateType === 'createDate' ? 'Tạo đơn' : searchDateType === 'shipTime' ? 'Xuất kho' : searchDateType === 'printTime' ? 'In phiếu' : searchDateType === 'packTime' ? 'Đóng gói' : 'Đồng bộ WMS'}]`;

    if (isCustomDate) {
      if (customDateFor && customDateTo) {
        if (customDateFor === customDateTo) {
          return `${dateTypeNote} Trọn vẹn ngày ${customDateFor} (từ 00:00 đến 23:59)`;
        }
        return `${dateTypeNote} Từ ${customDateFor} 00:00 đến ${customDateTo} 23:59 ${excludeToday ? `(Đã trừ hôm nay ${todayStr})` : `(⚡ Đến hiện tại ${todayStr} ${currentTimeStr})`}`;
      } else if (customDateFor) {
        return `${dateTypeNote} Trọn vẹn ngày ${customDateFor} (từ 00:00 đến 23:59)`;
      }
      return `${dateTypeNote} Tùy chọn khoảng ngày (Vui lòng điền Từ ngày - Đến ngày)`;
    }

    if (!dateInterval) {
      return excludeToday
        ? `${dateTypeNote} Toàn bộ quá khứ đến hết ngày hôm qua (${yesterdayStr}) - Không kéo đơn hôm nay`
        : `${dateTypeNote} ⚡ Toàn bộ đơn Shipper từ trước đến đúng hiện tại (${todayStr} ${currentTimeStr}) - Không trừ ngày!`;
    }

    const days = parseInt(dateInterval, 10);
    if (isNaN(days) || days <= 0) return `${dateTypeNote} Toàn bộ đơn hàng`;

    if (excludeToday) {
      const pastMs = now.getTime() - (days * oneDayMs);
      const fromStr = vnFormatter.format(new Date(pastMs));
      return `${dateTypeNote} ${days} ngày: từ ${fromStr} đến hôm qua ${yesterdayStr} (Đã trừ hôm nay ${todayStr})`;
    } else {
      if (days === 1) {
        return `${dateTypeNote} ⚡ Hôm nay: Quét thời gian thực toàn bộ đơn hôm nay (${todayStr}) tính đến ${currentTimeStr}!`;
      }
      const pastMs = now.getTime() - (days - 1) * oneDayMs;
      const fromStr = vnFormatter.format(new Date(pastMs));
      return `${dateTypeNote} ⚡ ${days} ngày gần nhất: từ ${fromStr} đến hiện tại (${todayStr} ${currentTimeStr}) - Bao gồm đơn hôm nay!`;
    }
  };

  const handleStartSync = async () => {
    if (isCustomDate && !customDateFor) {
      onToast('Vui lòng chọn ngày cần cào!');
      return;
    }

    const effectiveCustomDateTo = customDateTo || customDateFor;

    setIsLoading(true);
    setTestMessage('');
    setProgressPercent(0);
    setLoadedCount(0);
    setEtaText('Đang kết nối & phân tích...');
    setSpeedText('');
    setStatusMessage(`Đang kích hoạt ${threads} luồng kết nối YunWMS Cloud...`);
    setActiveThreadsCount(threads);
    isStoppingRef.current = false;
    accumulatedOrdersRef.current = [];
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    const startTime = Date.now();
    const isUnlimited = limit <= 0;
    let targetTotal = isUnlimited ? 0 : limit;
    setTargetCount(targetTotal);

    try {
      abortControllerRef.current = new AbortController();
      let allOrders: any[] = [];

      const response = await fetch('/api/yunwms/sync-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          userName,
          userPass,
          limit: isUnlimited ? 0 : targetTotal,
          warehouseId,
          dateInterval: isCustomDate ? '' : dateInterval,
          dateFor: isCustomDate ? customDateFor : '',
          dateTo: isCustomDate ? effectiveCustomDateTo : '',
          searchDateType,
          customerCode: customerCode.trim(),
          orderStatus,
          concurrency: threads,
          pageSize: 100,
          only8623AndSpxvn: carrierFilterMode === 'spx_jt',
          excludeToday,
          carrierFilterMode,
          selectedCarriers,
          customPrefixes
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Lỗi phản hồi từ máy chủ (Mã HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (!isStoppingRef.current) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.substring(5).trim();
          if (!jsonStr) continue;

          try {
            const msg = JSON.parse(jsonStr);

            if (msg.type === 'init') {
              targetTotal = msg.targetCount || msg.totalWmsOrders || 0;
              setTotalWmsCount(msg.totalWmsOrders || 0);
              setTargetCount(targetTotal);
              setActiveThreadsCount(msg.concurrency || threads);

              if (Array.isArray(msg.orders) && msg.orders.length > 0) {
                allOrders = allOrders.concat(msg.orders);
                accumulatedOrdersRef.current = allOrders;
                setLoadedCount(allOrders.length);
              }

              setStatusMessage(`⚡ Đang tải đa luồng (${msg.concurrency || threads} luồng) từ ${msg.warehouseName || 'WMS'}...`);
            } else if (msg.type === 'chunk') {
              if (Array.isArray(msg.orders) && msg.orders.length > 0) {
                allOrders = allOrders.concat(msg.orders);
                accumulatedOrdersRef.current = allOrders;
                setLoadedCount(allOrders.length);
              }

              const currentCount = allOrders.length;
              const currentTarget = Math.max(targetTotal, currentCount);
              const percent = currentTarget > 0 ? Math.min(100, Math.round((currentCount / currentTarget) * 100)) : 100;
              setProgressPercent(percent);

              const elapsedSeconds = Math.max(0.1, (Date.now() - startTime) / 1000);
              const speed = currentCount / elapsedSeconds;
              setSpeedText(`${speed.toFixed(1)} đơn/giây`);

              const remainingCount = Math.max(0, currentTarget - currentCount);
              if (remainingCount > 0 && speed > 0) {
                const etaSec = Math.ceil(remainingCount / speed);
                if (etaSec < 60) {
                  setEtaText(`Còn ~${etaSec} giây`);
                } else {
                  const min = Math.floor(etaSec / 60);
                  const sec = etaSec % 60;
                  setEtaText(`Còn ~${min} phút ${sec} giây`);
                }
              } else {
                setEtaText('Sắp hoàn tất');
              }

              setStatusMessage(`⚡ [Luồng #${msg.workerId}] Đang cào trang ${msg.page} (Đã nhận ${currentCount.toLocaleString()} đơn)`);
            } else if (msg.type === 'done') {
              setProgressPercent(100);
              setEtaText('Đã tải hoàn tất!');
              setStatusMessage(`Hoàn tất! Đã kéo thành công ${allOrders.length.toLocaleString()} đơn.`);
            } else if (msg.type === 'error') {
              throw new Error(msg.error);
            }
          } catch (e: any) {
            if (e.message && !e.message.includes('JSON')) {
              throw e;
            }
          }
        }
      }

      if (allOrders.length === 0) {
        onToast('Không có đơn hàng nào khớp với điều kiện lọc trên YunWMS.');
        setIsLoading(false);
        return;
      }

      setProgressPercent(100);
      setEtaText('Đã tải hoàn tất!');
      setStatusMessage(`Đã kéo thành công ${allOrders.length.toLocaleString()} đơn từ YunWMS.`);

      const convertedOrders = convertRawToOrderItems(allOrders);
      onToast(`Đã đồng bộ siêu tốc ${convertedOrders.length.toLocaleString()} đơn từ YunWMS!`);
      
      setTimeout(() => {
        onSyncComplete(convertedOrders, autoTrack, appendMode);
        onClose();
      }, 400);

    } catch (err: any) {
      if (err.name === 'AbortError' || isStoppingRef.current) {
        if (accumulatedOrdersRef.current.length > 0) {
          const converted = convertRawToOrderItems(accumulatedOrdersRef.current);
          onToast(`Đã dừng. Lấy ${converted.length.toLocaleString()} đơn đã tải về.`);
          onSyncComplete(converted, autoTrack, appendMode);
          onClose();
          return;
        }
      }
      setTestSuccess(false);
      setTestMessage(err.message || 'Lỗi khi đồng bộ dữ liệu YunWMS');
      setStatusMessage('Đồng bộ thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-sm shrink-0">
              <CloudDownload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight">Đồng Bộ & Quét Dữ Liệu YunWMS</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  LIVE API
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Kéo Order No., RefNo., và Tracking No. trực tiếp từ hệ thống WMS Cloud
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div ref={modalBodyRef} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          
          {/* Live Progress Bar if Loading */}
          {isLoading && (
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-100/50 border-2 border-emerald-400 rounded-xl p-4.5 space-y-3 shadow-md animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-700 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-950 uppercase tracking-wider font-mono">
                    Tiến Độ Tải Đa Luồng YunWMS
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-emerald-600 text-white shadow-xs font-mono">
                    ⚡ {activeThreadsCount} Luồng Song Song
                  </span>
                </div>
                <span className="text-base font-black text-emerald-900 font-mono">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress Bar with animated gradient */}
              <div className="w-full bg-emerald-200/90 rounded-full h-4 overflow-hidden shadow-inner p-0.5">
                <div 
                  className="bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1 shadow-sm"
                  style={{ width: `${Math.max(4, progressPercent)}%` }}
                >
                  <div className="w-2 h-2 bg-white rounded-full animate-ping opacity-90" />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                <div className="bg-white/90 rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block">Đã tải về</span>
                  <span className="text-slate-900 font-bold text-xs">
                    {loadedCount.toLocaleString()} / {targetCount.toLocaleString()} đơn
                  </span>
                </div>

                <div className="bg-white/90 rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block flex items-center">
                    <Timer className="w-3 h-3 mr-1 text-emerald-700" />
                    Dự kiến còn
                  </span>
                  <span className="text-emerald-800 font-bold text-xs">
                    {etaText || 'Đang tính...'}
                  </span>
                </div>

                <div className="bg-white/90 rounded-lg p-2 border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-semibold block flex items-center">
                    <Zap className="w-3 h-3 mr-1 text-amber-600" />
                    Tốc độ cào
                  </span>
                  <span className="text-emerald-700 font-bold text-xs">
                    {speedText || 'Đang tăng tốc...'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-slate-700 font-medium text-[11px] truncate max-w-[280px]">
                  {statusMessage}
                </span>
                <button
                  type="button"
                  onClick={handleStopAndUseLoaded}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 border border-rose-300 rounded-md cursor-pointer transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5 mr-1" />
                  Dừng & Lấy ngay {loadedCount} đơn
                </button>
              </div>
            </div>
          )}

          {/* 🎯 BỘ LỌC ĐẶC BIỆT: CHỌN ĐẦU MÃ VẬN ĐƠN & HÃNG VẬN CHUYỂN */}
          <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/50 to-amber-50/80 border-2 border-amber-300/80 rounded-xl p-4 space-y-3.5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider font-mono block">
                    Bộ Lọc Đầu Mã Vận Đơn & Nhà Vận Chuyển
                  </span>
                  <span className="text-[10px] text-amber-800">
                    Chọn nhanh các luồng mã cần cào từ YunWMS để kiểm soát tồn kho
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-2xs border bg-amber-200/90 border-amber-300 text-amber-900">
                {carrierFilterMode === 'spx_jt' && '🎯 SPX + J&T (Khuyên dùng kho)'}
                {carrierFilterMode === 'all' && '🌐 Tất cả các hãng (Không lọc)'}
                {carrierFilterMode === 'custom' && `🛠️ Tùy chọn (${selectedCarriers.length} hãng, ${customPrefixes.length} mã)`}
              </span>
            </div>

            {/* 1. Quick Presets Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-1.5 pt-0.5">
              {/* Preset 1: SPX + J&T + VNPost (Mặc định chuẩn kho) */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('spx_jt');
                  setSelectedCarriers(['spx', 'jt', 'vnpost']);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'spx_jt'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>🎯 SPX + J&T + VNPost</span>
                  {carrierFilterMode === 'spx_jt' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'spx_jt' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Khuyên dùng cho kho
                </span>
              </button>

              {/* Preset 2: Chỉ VNPost / EMS */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('custom');
                  setSelectedCarriers(['vnpost']);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('vnpost')
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>📮 Chỉ VNPost / EMS</span>
                  {carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('vnpost') && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('vnpost') ? 'text-amber-100' : 'text-slate-500'}`}>
                  Mã EA/EB...VN, EMS
                </span>
              </button>

              {/* Preset 3: Chỉ SPX */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('custom');
                  setSelectedCarriers(['spx']);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('spx')
                    ? 'bg-red-600 text-white border-red-700 shadow-xs ring-2 ring-red-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>🟧 Chỉ SPX Shopee</span>
                  {carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('spx') && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('spx') ? 'text-red-100' : 'text-slate-500'}`}>
                  Mã SPXVN, SPX (~66%)
                </span>
              </button>

              {/* Preset 4: Chỉ J&T */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('custom');
                  setSelectedCarriers(['jt', 'jt_cargo']);
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'custom' && selectedCarriers.includes('jt') && selectedCarriers.includes('jt_cargo') && selectedCarriers.length === 2
                    ? 'bg-rose-600 text-white border-rose-700 shadow-xs ring-2 ring-rose-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>🟥 Chỉ J&T (Đầu 8 & 53)</span>
                  {carrierFilterMode === 'custom' && selectedCarriers.includes('jt') && selectedCarriers.includes('jt_cargo') && selectedCarriers.length === 2 && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'custom' && selectedCarriers.includes('jt') && selectedCarriers.includes('jt_cargo') && selectedCarriers.length === 2 ? 'text-rose-100' : 'text-slate-500'}`}>
                  J&T Tiêu chuẩn & Cargo
                </span>
              </button>

              {/* Preset 5: Chỉ Best Express */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('custom');
                  setSelectedCarriers(['best']);
                  setOrderStatus(''); // Cào tất cả trạng thái để lấy đơn Đã nộp 4, Dán nhãn 7
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('best')
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-2 ring-blue-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>📦 Chỉ Best Express</span>
                  {carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('best') && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'custom' && selectedCarriers.length === 1 && selectedCarriers.includes('best') ? 'text-blue-100' : 'text-slate-500'}`}>
                  Mã TTVN... TikTok/TMĐT
                </span>
              </button>

              {/* Preset 6: Tất cả (Không lọc) */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('all');
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'all'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>🌐 Tất cả các hãng</span>
                  {carrierFilterMode === 'all' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'all' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Toàn bộ 100% đơn kho
                </span>
              </button>

              {/* Preset 7: Tùy chỉnh tự do */}
              <button
                type="button"
                onClick={() => {
                  setCarrierFilterMode('custom');
                }}
                className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-all text-left flex flex-col justify-between cursor-pointer border ${
                  carrierFilterMode === 'custom' && !(selectedCarriers.length === 1 && selectedCarriers.includes('spx')) && !(selectedCarriers.includes('jt') && selectedCarriers.includes('jt_cargo') && selectedCarriers.length === 2) && !(selectedCarriers.length === 1 && selectedCarriers.includes('vnpost')) && !(selectedCarriers.length === 1 && selectedCarriers.includes('best'))
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/40'
                    : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span>🛠️ Tùy chọn hãng</span>
                  {carrierFilterMode === 'custom' && !(selectedCarriers.length === 1 && selectedCarriers.includes('spx')) && !(selectedCarriers.includes('jt') && selectedCarriers.includes('jt_cargo') && selectedCarriers.length === 2) && !(selectedCarriers.length === 1 && selectedCarriers.includes('vnpost')) && !(selectedCarriers.length === 1 && selectedCarriers.includes('best')) && <Check className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[10px] mt-1 font-normal ${carrierFilterMode === 'custom' ? 'text-amber-100' : 'text-slate-500'}`}>
                  Chọn từng hãng & mã riêng
                </span>
              </button>
            </div>

            {/* 2. Multi-Select Carrier Chips (Visible when Custom Mode is active) */}
            {carrierFilterMode === 'custom' && (
              <div className="bg-white/90 border border-amber-200/90 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-600" />
                    Chọn các hãng vận chuyển cần kéo:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCarriers(HISTORICAL_CARRIER_PREFIXES.map(d => d.id))}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer underline"
                    >
                      Chọn tất cả
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCarriers(['spx', 'jt', 'vnpost'])}
                      className="text-[11px] text-amber-700 hover:text-amber-900 font-semibold cursor-pointer underline"
                    >
                      Mặc định (SPX+J&T+VNPost)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {HISTORICAL_CARRIER_PREFIXES.map((carrier) => {
                    const isSelected = selectedCarriers.includes(carrier.id);
                    return (
                      <div
                        key={carrier.id}
                        onClick={() => handleToggleCarrier(carrier.id)}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-start gap-2 ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-400 shadow-2xs ring-1 ring-amber-400/50'
                            : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100/80 opacity-70'
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {carrier.shortName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">
                              {carrier.historicalShare}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 truncate mt-0.5">
                            Đầu mã: <strong className="text-slate-800">{carrier.prefixes.slice(0, 3).join(', ')}</strong>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Prefix Tag Input */}
                <div className="pt-2 border-t border-amber-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                      Nhập thêm đầu mã tùy chỉnh riêng (nếu có):
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Gõ dấu phẩy hoặc nhấn Thêm
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customPrefixInput}
                      onChange={(e) => setCustomPrefixInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomPrefix();
                        }
                      }}
                      placeholder="VD: 8623, SPXVN, 5306, VNGH..."
                      className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomPrefix}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm mã
                    </button>
                  </div>

                  {customPrefixes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {customPrefixes.map((pfx) => (
                        <span
                          key={pfx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-amber-100 text-amber-900 border border-amber-300"
                        >
                          <span>{pfx}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomPrefix(pfx)}
                            className="text-amber-700 hover:text-amber-950 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Collapsible Knowledge Dictionary: "Từ điển nhận diện đầu mã đã học từ WMS" */}
            <div className="bg-white/80 border border-amber-200 rounded-xl overflow-hidden shadow-2xs">
              <button
                type="button"
                onClick={() => setShowPrefixDictionary(!showPrefixDictionary)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-amber-50/60 transition-colors cursor-pointer"
              >
                <span className="text-xs font-bold text-amber-950 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  📖 Bảng Tra Cứu & Nhận Diện Đầu Mã Vận Đơn (Học từ 179.000+ đơn YunWMS)
                </span>
                <span className="text-xs text-amber-800 flex items-center gap-1 font-medium">
                  {showPrefixDictionary ? 'Thu gọn' : 'Xem chi tiết'}
                  {showPrefixDictionary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {showPrefixDictionary && (
                <div className="p-3 border-t border-amber-100 overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-amber-200 text-amber-950 bg-amber-100/50">
                        <th className="py-2 px-2.5 font-bold">Đơn vị vận chuyển</th>
                        <th className="py-2 px-2.5 font-bold">Quy tắc đầu mã</th>
                        <th className="py-2 px-2.5 font-bold">Mẫu mã thực tế WMS</th>
                        <th className="py-2 px-2.5 font-bold">Tỷ lệ kho VN02</th>
                        <th className="py-2 px-2.5 font-bold">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 text-slate-700">
                      {HISTORICAL_CARRIER_PREFIXES.map((item) => (
                        <tr key={item.id} className="hover:bg-amber-50/40">
                          <td className="py-2 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                            <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${item.isCoreWarehouse ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {item.name}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[11px] text-amber-900 font-bold whitespace-nowrap">
                            {item.prefixes.join(', ')}
                          </td>
                          <td className="py-2 px-2.5 font-mono text-[11px] text-slate-600">
                            {item.samples.slice(0, 2).join(', ')}
                          </td>
                          <td className="py-2 px-2.5 font-bold text-slate-800 whitespace-nowrap">
                            <span className="text-amber-700">{item.historicalShare}</span>
                            <span className="text-[10px] text-slate-500 font-normal block">{item.estimatedCount}</span>
                          </td>
                          <td className="py-2 px-2.5 text-[11px] text-slate-600">
                            {item.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 text-[11px] text-slate-500 italic bg-amber-50/60 p-2 rounded-lg border border-amber-200/60">
                    💡 <strong>Ghi chú thực tế:</strong> Kho VN02 Hồ Chí Minh vận hành chủ lực với <strong>Shopee Express (SPX)</strong> và <strong>J&T Express (Đầu 8)</strong> chiếm hơn 85% sản lượng. Hệ thống đã tối ưu bắt 100% chính xác hai luồng này.
                  </div>
                </div>
              )}
            </div>

            {/* 4. CHỌN CHẾ ĐỘ QUÉT: THỜI GIAN THỰC (KHÔNG -1) VS AN TOÀN (-1 NGÀY) */}
            <div className="pt-1 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-950 uppercase tracking-wider flex items-center font-mono">
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Chế Độ Quét Thời Gian:
                </span>
                <span className="text-[10px] font-mono text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                  Giờ VN (GMT+7)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Mode 1: THỜI GIAN THỰC (KHÔNG TRỪ 1 NGÀY) */}
                <div
                  onClick={() => handleToggleRealtime(true)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-2.5 ${
                    !excludeToday
                      ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-2 ring-emerald-400/40'
                      : 'bg-white/60 border-slate-200 hover:bg-white opacity-70'
                  }`}
                >
                  <input
                    type="radio"
                    name="realtime_mode"
                    checked={!excludeToday}
                    onChange={() => handleToggleRealtime(true)}
                    className="w-4 h-4 mt-0.5 text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                      <span>⚡ QUÉT THỜI GIAN THỰC (Không -1)</span>
                      {!excludeToday && (
                        <span className="text-[9px] font-bold bg-emerald-600 text-white px-1.5 py-0.2 rounded-full uppercase">
                          Khuyên dùng
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-emerald-800 mt-0.5 leading-snug">
                      Kéo trực tiếp đến đúng <strong>giây phút hiện tại</strong> (gồm cả hôm nay). Cứ có trạng thái <strong>Shipper (Đã xuất kho)</strong> là quét live ngay lập tức!
                    </p>
                  </div>
                </div>

                {/* Mode 2: QUÉT AN TOÀN (-1 NGÀY) */}
                <div
                  onClick={() => handleToggleRealtime(false)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-2.5 ${
                    excludeToday
                      ? 'bg-amber-50 border-amber-500 shadow-sm ring-2 ring-amber-400/40'
                      : 'bg-white/60 border-slate-200 hover:bg-white opacity-70'
                  }`}
                >
                  <input
                    type="radio"
                    name="realtime_mode"
                    checked={excludeToday}
                    onChange={() => handleToggleRealtime(false)}
                    className="w-4 h-4 mt-0.5 text-amber-600 border-slate-300 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>📅 QUÉT AN TOÀN (-1 Ngày)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                      Chỉ chốt sổ các đơn từ <strong>hôm qua trở về trước</strong> ({new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(Date.now() - 24 * 60 * 60 * 1000))}). Bỏ qua ngày hôm nay.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Khối Tìm Kiếm Date Chuẩn Khớp 100% YunWMS */}
          <div className="search-module-condition bg-amber-50/80 border-2 border-amber-300/90 rounded-xl p-3.5 space-y-3 shadow-xs" id="order_order_searchDateType">
            {/* Header: Title + Select searchDateType */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200">
              <div className="flex items-center space-x-2">
                <span className="searchFilterText text-xs font-black text-amber-950 uppercase tracking-wider font-mono flex items-center">
                  <Calendar className="w-4 h-4 mr-1.5 text-amber-700" />
                  Date：
                </span>
                
                {/* WMS exact select searchDateType */}
                <select
                  name="searchDateType"
                  id="searchDateType"
                  value={searchDateType}
                  onChange={(e) => setSearchDateType(e.target.value)}
                  className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs cursor-pointer"
                >
                  <option value="createDate">Order creation time</option>
                  <option value="printTime">Print time</option>
                  <option value="packTime">Packing time</option>
                  <option value="shipTime">Shipping time</option>
                  <option value="syncWmsTime">Synchronization Time</option>
                </select>
              </div>

              <span className="text-[11px] text-amber-900 font-bold bg-amber-200/70 px-2 py-0.5 rounded flex items-center gap-1 self-start sm:self-auto">
                <span>⚡ Đồng bộ chuẩn czwh.wms.yunwms.com</span>
              </span>
            </div>

            {/* Inline Date Inputs (dateFor & dateTo) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor="dateFor" className="text-xs font-bold text-slate-800 font-mono">Từ:</label>
                <input
                  type="date"
                  name="dateFor"
                  id="dateFor"
                  value={customDateFor}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomDateFor(val);
                    setIsCustomDate(true);
                    if (!customDateTo || customDateTo < val) {
                      setCustomDateTo(val);
                    }
                  }}
                  className="datepicker input_text keyToSearch hasDatepicker px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  style={{ minWidth: '130px' }}
                />
              </div>

              <span className="text-xs font-black text-slate-600 font-mono px-0.5">To</span>

              <div className="flex items-center gap-1.5">
                <label htmlFor="dateTo" className="text-xs font-bold text-slate-800 font-mono">Đến:</label>
                <input
                  type="date"
                  name="dateTo"
                  id="dateTo"
                  value={customDateTo}
                  onChange={(e) => {
                    setCustomDateTo(e.target.value);
                    setIsCustomDate(true);
                  }}
                  className="datepickerTo input_text keyToSearch hasDatepicker px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                  style={{ minWidth: '130px' }}
                />
              </div>

              {/* Fast 1-click Target Date Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCustomDateFor(todayStr);
                    setCustomDateTo(todayStr);
                    setIsCustomDate(true);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer border ${
                    isCustomDate && customDateFor === todayStr && customDateTo === todayStr
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-400/50'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                  }`}
                >
                  ⚡ Hôm nay ({todayStr.slice(8)}) (Thời gian thực)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const yest = new Date(Date.now() - 86400000);
                    const yestStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(yest);
                    setCustomDateFor(yestStr);
                    setCustomDateTo(yestStr);
                    setIsCustomDate(true);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isCustomDate && customDateFor !== todayStr && customDateFor !== '2026-09-17'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/50'
                      : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  📅 Hôm qua
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomDateFor('2026-09-17');
                    setCustomDateTo('2026-09-17');
                    setIsCustomDate(true);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isCustomDate && customDateFor === '2026-09-17' && customDateTo === '2026-09-17'
                      ? 'bg-amber-600 text-white border-amber-700 shadow-xs ring-2 ring-amber-400/50'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  📅 Ngày 17
                </button>
              </div>
            </div>

            {/* Quick Multi-Day Preset Shortcuts */}
            <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-amber-200/60">
              <span className="text-[11px] font-bold text-slate-600 mr-1">Khoảng ngày khác:</span>
              <button
                type="button"
                onClick={() => {
                  setIsCustomDate(false);
                  setDateInterval('3');
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                  !isCustomDate && dateInterval === '3'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                3 ngày gần nhất
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCustomDate(false);
                  setDateInterval('7');
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                  !isCustomDate && dateInterval === '7'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                7 ngày
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCustomDate(false);
                  setDateInterval('30');
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                  !isCustomDate && dateInterval === '30'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                30 ngày
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsCustomDate(false);
                  setDateInterval('');
                }}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border ${
                  !isCustomDate && dateInterval === ''
                    ? 'bg-slate-900 text-white border-slate-950 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                🚀 Toàn bộ
              </button>
            </div>

            {/* Explanation box */}
            <div className="text-[11px] text-slate-600 bg-white/90 p-2.5 rounded-lg border border-amber-200 leading-relaxed shadow-2xs">
              💡 <strong>Cơ chế đồng bộ thời gian thực:</strong> Khi chọn ngày <strong>{customDateFor || todayStr}</strong>, hệ thống tự động thiết lập phạm vi thời gian từ <code>{customDateFor || todayStr} 00:00</code> đến <code>{customDateTo || customDateFor || todayStr} 23:59</code> theo tiêu chí <strong>{searchDateType}</strong>. Kết quả cào về kết nối trực tiếp đến máy chủ <code>czwh.wms.yunwms.com</code> để kéo 100% đơn hàng thực tế của kho (không giới hạn, cập nhật theo từng giây).
            </div>
            {/* Real-time date range summary badge */}
            <div className="text-[11px] font-medium text-emerald-900 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between">
              <span className="flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 shrink-0" />
                <strong>Phạm vi cào:</strong>&nbsp;{getDateRangeDescription()}
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                Giờ VN (GMT+7)
              </span>
            </div>
          </div>

          {/* Connection Details */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center font-mono">
                <Server className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                Cổng Kết Nối Hệ Thống WMS
              </span>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isLoading}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Kiểm tra kết nối
              </button>
            </div>

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Địa chỉ WMS Server
                </label>
                <div className="flex items-center px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
                  <Globe className="w-3.5 h-3.5 mr-2 text-slate-400 shrink-0" />
                  <span className="truncate">{wmsUrl}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Tên đăng nhập (Username)
                  </label>
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="David"
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Mật khẩu (Password)
                  </label>
                  <div className="relative">
                    <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      value={userPass}
                      onChange={(e) => setUserPass(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>
            </div>

            {testSuccess !== null && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                testSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {testSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span className="font-medium">{testMessage}</span>
              </div>
            )}
          </div>

          {/* Multi-Threading Boost Engine */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-4 space-y-3 shadow-md border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider flex items-center font-mono text-emerald-400">
                <Zap className="w-4 h-4 mr-1.5 text-amber-400 animate-pulse" />
                Cơ Chế Cào Đa Luồng Siêu Tốc (Turbo Concurrency)
              </span>
              <span className="text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                ⚡ Tăng tốc 30x - 40x
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Khai thác nhiều luồng kết nối song song về máy chủ YunWMS, kéo <strong>100.000+ đơn</strong> chỉ mất <strong>~1 - 2 phút</strong> thay vì 36 phút.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setThreads(20)}
                className={`px-3 py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer border ${
                  threads === 20
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm ring-2 ring-emerald-400/50'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className="text-xs font-black">⚡⚡ 20 Luồng</div>
                <div className="text-[10px] text-emerald-200 mt-0.5">Siêu Tốc (Khuyên dùng)</div>
              </button>

              <button
                type="button"
                onClick={() => setThreads(30)}
                className={`px-3 py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer border ${
                  threads === 30
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm ring-2 ring-emerald-400/50'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className="text-xs font-black">🚀 30 Luồng</div>
                <div className="text-[10px] text-amber-200 mt-0.5">Cực Đại (Max Turbo)</div>
              </button>

              <button
                type="button"
                onClick={() => setThreads(10)}
                className={`px-3 py-2 rounded-lg text-xs font-bold text-center transition-all cursor-pointer border ${
                  threads === 10
                    ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm ring-2 ring-emerald-400/50'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <div className="text-xs font-black">⚡ 10 Luồng</div>
                <div className="text-[10px] text-slate-300 mt-0.5">Tiêu Chuẩn</div>
              </button>
            </div>
          </div>

          {/* Sync Configuration Options */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center font-mono">
              <Sliders className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
              Bộ Lọc Kho Hàng & Đơn Vận
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Kho hàng WMS (E4) */}
              <div className="sm:col-span-2 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center justify-between">
                  <span className="flex items-center">
                    <Database className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                    Kho hàng YunWMS (Tham số E4)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                    #E4_chosen
                  </span>
                </label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                >
                  <option value="7">VN02 [越南胡志明仓库] - Kho Hồ Chí Minh (Khuyên dùng)</option>
                  <option value="4">VN01 [VN01越南海外仓] - Kho Hải Ngoại VN01</option>
                  <option value="">All - Tất cả kho</option>
                </select>
              </div>

              {/* Số lượng đơn */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số lượng đơn cần kéo
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value={0}>🚀 Toàn bộ đơn trong khoảng ngày (Không giới hạn 5k)</option>
                  <option value={500}>500 đơn gần đây</option>
                  <option value={1000}>1.000 đơn gần đây</option>
                  <option value={2000}>2.000 đơn gần đây</option>
                  <option value={5000}>5.000 đơn gần đây</option>
                  <option value={10000}>10.000 đơn</option>
                  <option value={20000}>20.000 đơn</option>
                  <option value={50000}>50.000 đơn</option>
                </select>
              </div>

              {/* Mã khách hàng / Shop */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã khách hàng (Customer Code)
                </label>
                <input
                  type="text"
                  value={customerCode}
                  onChange={(e) => setCustomerCode(e.target.value)}
                  placeholder="VD: YD (để trống nếu lấy tất cả)"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* Trạng thái kho */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Trạng thái xử lý WMS</span>
                  <span className="text-[11px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded">
                    Mặc định: Tất cả trạng thái (Bao gồm Đã nộp, Dán nhãn, Xuất kho)
                  </span>
                </label>
                <select
                  value={orderStatus}
                  onChange={(e) => setOrderStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="8">🚚 Chỉ đơn Đã xuất kho (Trạng thái Shipper / Shipped - Mã 8) [Khớp 100% cột Status Shipped trên WMS, VD: 1.453 đơn]</option>
                  <option value="">🌐 Tất cả trạng thái kho WMS (Đã nộp, Dán nhãn, Xuất kho) [Toàn bộ đơn kho]</option>
                  <option value="4">Đã nộp (Chờ xử lý xuất - Mã 4)</option>
                  <option value="7">Đã dán nhãn (Mã 7)</option>
                  <option value="5">Đã hạ kệ</option>
                  <option value="2">Đã xác nhận</option>
                  <option value="0">⚠️ Đã xóa (Đơn sàn/khách đã hủy)</option>
                  <option value="14">⛔ Đã cắt đơn (Đơn hủy đóng gói)</option>
                  <option value="3">⚡ Bất thường (Lỗi/khiếu nại)</option>
                </select>
              </div>
            </div>

            {/* Automation checkmarks */}
            <div className="pt-2 space-y-2 border-t border-slate-100">
              <label className="flex items-center space-x-2.5 text-xs text-slate-800 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoTrack}
                  onChange={(e) => setAutoTrack(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="flex items-center">
                  <Zap className="w-3.5 h-3.5 text-amber-500 mr-1.5" />
                  <strong>Tự động tra cứu Live API ngay</strong> sau khi kéo mã về (Kiểm tra Đã Scan / Chưa Scan)
                </span>
              </label>

              <label className="flex items-center space-x-2.5 text-xs text-slate-700 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="w-4 h-4 text-slate-900 rounded border-slate-300 focus:ring-slate-900"
                />
                <span className="font-semibold text-slate-900">
                  Gộp & Nối thêm vào danh sách hiện tại (Không xóa đè dữ liệu cũ - Khuyên dùng)
                </span>
              </label>
            </div>

          </div>

          {/* Info note */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Dữ liệu sẽ tự động bóc tách <strong>Order No.</strong> (VD: YD-260825-1713), <strong>RefNo.</strong> (Mã tham chiếu), và <strong>Tracking No.</strong> (Mã vận đơn bưu điện/J&T/SPX/GHN) và đồng bộ chính xác 100% về bảng điều khiển.
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
          >
            Đóng
          </button>

          {isLoading ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStopAndUseLoaded}
                className="inline-flex items-center px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg shadow-sm transition-all cursor-pointer animate-pulse"
              >
                <StopCircle className="w-4 h-4 mr-1.5" />
                Dừng & Lấy ngay {loadedCount > 0 ? `(${loadedCount.toLocaleString()} đơn)` : ''}
              </button>
              <div className="inline-flex items-center px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 rounded-lg">
                <RefreshCw className="w-4 h-4 mr-2 text-emerald-700 animate-spin" />
                Đang cào {progressPercent}% ({loadedCount.toLocaleString()} / {targetCount > 0 ? targetCount.toLocaleString() : '...'})
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartSync}
              className="inline-flex items-center px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 mr-1.5 text-amber-300" />
              Bắt Đầu Cào Đa Luồng ({threads} Luồng) • {isCustomDate ? (customDateFor && customDateTo ? `Từ ${customDateFor} đến ${customDateTo}` : 'Tùy Chọn Ngày') : (dateInterval === '3' ? '3 Ngày Gần Nhất' : dateInterval === '7' ? '7 Ngày Gần Nhất' : dateInterval === '14' ? '14 Ngày' : dateInterval === '30' ? '30 Ngày' : 'Toàn Bộ')} {limit > 0 ? `(${limit.toLocaleString()} đơn)` : '(Không Giới Hạn)'}
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
