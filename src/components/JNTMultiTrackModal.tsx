import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Zap, 
  Copy, 
  Check, 
  CheckCircle2, 
  Clock, 
  Truck, 
  CheckCheck, 
  AlertOctagon, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  RotateCw,
  Info,
  Layers,
  Sparkles
} from 'lucide-react';
import { OrderItem, TrackingStatusCategory } from '../types/tracking';
import { getJNTMultiTrackingUrl } from '../services/carrierDetector';

interface JNTMultiTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  onImportOrders?: (codes: string[], carrier?: any, extraList?: any[]) => void;
  existingJtCodes?: string[];
  defaultPhone?: string;
}

interface JNTResultItem {
  code: string;
  success: boolean;
  statusCategory?: TrackingStatusCategory;
  rawStatusText?: string;
  statusDetail?: string;
  scannedAt?: string;
  updatedAt?: string;
  recipientLocation?: string;
  timeline?: {
    time: string;
    statusText: string;
    location: string;
    description: string;
  }[];
  error?: string;
}

export const JNTMultiTrackModal: React.FC<JNTMultiTrackModalProps> = ({
  isOpen,
  onClose,
  onToast,
  onImportOrders,
  existingJtCodes = [],
  defaultPhone = '8836'
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [cellphone, setCellphone] = useState<string>(defaultPhone || '8836');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Record<string, JNTResultItem> | null>(null);
  const [expandedCodes, setExpandedCodes] = useState<Record<string, boolean>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  if (!isOpen) return null;

  // Helper parser for pasted text / URL / comma-separated / newline
  const parseBillCodes = (text: string): { codes: string[]; phone?: string } => {
    let extractedPhone = '';
    const cleanCodes: string[] = [];

    // 1. Check if input contains J&T or tracking URL
    if (text.includes('billcode=') || text.includes('order_code=') || text.includes('jtexpress.vn')) {
      let decoded = text;
      try {
        decoded = decodeURIComponent(text);
      } catch {}

      const pMatch = decoded.match(/(?:cellphone|phone|tel)=(\d+)/i);
      if (pMatch) {
        extractedPhone = pMatch[1];
      }

      const bMatch = decoded.match(/(?:billcode|order_code)=([^&]+)/i);
      if (bMatch) {
        const raw = bMatch[1].split(/[,\s\r\n]+/).map(c => c.trim()).filter(Boolean);
        for (const c of raw) {
          const sanitized = c.replace(/[^a-zA-Z0-9_-]/g, '');
          if (sanitized.length >= 4 && !cleanCodes.includes(sanitized)) {
            cleanCodes.push(sanitized);
          }
        }
      }
    }

    // 2. Delimited by comma, semicolon, space, newline
    if (cleanCodes.length === 0) {
      const parts = text.split(/[\r\n,;\t|]+/).map(p => p.trim()).filter(Boolean);
      for (const p of parts) {
        // If user typed: code 8836
        const spaceSub = p.split(/\s+/).filter(Boolean);
        if (spaceSub.length === 2 && /^\d{4,6}$/.test(spaceSub[1])) {
          if (!extractedPhone) extractedPhone = spaceSub[1];
          const sanitized = spaceSub[0].replace(/[^a-zA-Z0-9_-]/g, '');
          if (sanitized.length >= 4 && !cleanCodes.includes(sanitized)) {
            cleanCodes.push(sanitized);
          }
        } else {
          const sanitized = p.replace(/[^a-zA-Z0-9_-]/g, '');
          if (sanitized.length >= 4 && !cleanCodes.includes(sanitized)) {
            cleanCodes.push(sanitized);
          }
        }
      }
    }

    return {
      codes: cleanCodes.slice(0, 10), // J&T limits to 10 codes
      phone: extractedPhone
    };
  };

  const parsed = parseBillCodes(inputText);
  const currentCodes = parsed.codes;

  // Handle load sample 10 codes (from user's live example URL)
  const handleLoadSample = () => {
    const sampleCodes = [
      '862391601914',
      '862375230944',
      '862370960204',
      '862334748683',
      '862320676123',
      '862311754983',
      '862324824863',
      '862370022463',
      '862364861283',
      '862338768012'
    ];
    setInputText(sampleCodes.join(', '));
    setCellphone('8836');
    setResults(null);
    onToast('Đã nạp mẫu 10 mã vận đơn J&T Express!');
  };

  // Load from existing table
  const handleLoadFromTable = () => {
    if (existingJtCodes.length === 0) {
      onToast('Chưa có mã J&T nào trong bảng chính.');
      return;
    }
    const sample = existingJtCodes.slice(0, 10);
    setInputText(sample.join(', '));
    setResults(null);
    onToast(`Đã lấy ${sample.length} mã J&T từ bảng theo dõi!`);
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        onToast('Clipboard trống.');
        return;
      }
      setInputText(text);
      const parsedRes = parseBillCodes(text);
      if (parsedRes.phone) {
        setCellphone(parsedRes.phone);
      }
      onToast(`Đã dán và nhận diện ${parsedRes.codes.length} mã vận đơn!`);
    } catch {
      onToast('Không thể đọc clipboard. Vui lòng dán thủ công.');
    }
  };

  // Direct Web Tracking on J&T Express (Opens multi-billcode link in new tab)
  const handleOpenJNTWeb = () => {
    if (currentCodes.length === 0) {
      onToast('Vui lòng nhập ít nhất 1 mã vận đơn (tối đa 10 mã)!');
      return;
    }
    const phoneToUse = (cellphone || '8836').trim();
    const url = getJNTMultiTrackingUrl(currentCodes, phoneToUse);
    window.open(url, '_blank');
    onToast(`Đang mở trang tra cứu 10 vận đơn trên J&T Express (${currentCodes.length} mã)...`);
  };

  // Direct Live API Tracking (Queries backend API /api/track/jnt with batch of 10)
  const handleLiveQuery = async () => {
    if (currentCodes.length === 0) {
      onToast('Vui lòng nhập ít nhất 1 mã vận đơn (tối đa 10 mã)!');
      return;
    }

    setIsLoading(true);
    setResults(null);
    const phoneToUse = (cellphone || '8836').trim();

    try {
      const res = await fetch('/api/track/jnt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billCodes: currentCodes,
          cellphone: phoneToUse
        })
      });

      const data = await res.json();
      if (data.results) {
        const resultMap: Record<string, JNTResultItem> = {};
        const expandMap: Record<string, boolean> = {};

        for (const code of currentCodes) {
          const item = data.results[code];
          if (item && item.success && item.data) {
            resultMap[code] = {
              code,
              success: true,
              statusCategory: item.data.statusCategory,
              rawStatusText: item.data.rawStatusText,
              statusDetail: item.data.statusDetail,
              scannedAt: item.data.scannedAt,
              updatedAt: item.data.updatedAt,
              recipientLocation: item.data.recipientLocation,
              timeline: item.data.timeline
            };
            expandMap[code] = true; // Auto expand to show timeline
          } else {
            resultMap[code] = {
              code,
              success: false,
              error: item?.error || 'Không tìm thấy dữ liệu trên cổng J&T Express'
            };
          }
        }

        setResults(resultMap);
        setExpandedCodes(expandMap);
        onToast(`Đã nhận kết quả tra cứu cho ${currentCodes.length} mã!`);
      } else {
        onToast(data.error || 'Lỗi khi tra cứu J&T');
      }
    } catch (err: any) {
      onToast(`Lỗi kết nối: ${err?.message || 'Không thể tra cứu'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Import to main table
  const handleImportToTable = () => {
    if (currentCodes.length === 0) {
      onToast('Không có mã nào để thêm!');
      return;
    }
    if (onImportOrders) {
      const phoneToUse = (cellphone || '8836').trim();
      const extraList = currentCodes.map(() => ({ customerPhone: phoneToUse }));
      onImportOrders(currentCodes, 'jt', extraList);
      onToast(`Đã thêm ${currentCodes.length} mã J&T vào bảng theo dõi chính!`);
      onClose();
    }
  };

  const toggleExpand = (code: string) => {
    setExpandedCodes(prev => ({ ...prev, [code]: !prev[code] }));
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      onToast(`Đã sao chép mã: ${code}`);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {}
  };

  const getStatusBadge = (category?: TrackingStatusCategory, rawText?: string) => {
    switch (category) {
      case 'scanned':
      case 'in_transit':
      case 'delivered':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono">
            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
            ĐÃ SCAN ({category === 'delivered' ? 'GIAO THÀNH CÔNG' : 'ĐANG VẬN CHUYỂN'})
          </span>
        );
      case 'not_scanned':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-950 border border-amber-300 font-mono">
            <Clock className="w-3 h-3 mr-1 text-amber-700" />
            CHƯA SCAN (CHỜ LẤY)
          </span>
        );
      case 'returned':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300 font-mono">
            CHUYỂN HOÀN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-900 border border-rose-300 font-mono">
            <AlertOctagon className="w-3 h-3 mr-1 text-rose-600" />
            CHƯA CÓ DỮ LIỆU
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header with J&T Brand */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-rose-50 via-white to-rose-50/40">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm tracking-tighter shadow-md shadow-rose-200">
              J&T
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">
                  Tra Cứu 1 Lần 10 Đơn Hàng J&T Express
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 font-mono">
                  TỐI ĐA 10 MÃ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tra cứu cùng lúc 10 vận đơn trên cổng chính thức <span className="font-mono text-rose-600 font-semibold">jtexpress.vn/vi/tracking</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Quick Helper Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-2 text-slate-600 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-rose-600" />
              <span>Nạp nhanh mã vận đơn:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center"
              >
                📋 Dán từ Clipboard
              </button>
              <button
                type="button"
                onClick={handleLoadSample}
                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center"
              >
                ⚡ Nạp mẫu 10 mã ví dụ
              </button>
              {existingJtCodes.length > 0 && (
                <button
                  type="button"
                  onClick={handleLoadFromTable}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center"
                >
                  📥 Lấy 10 mã từ bảng ({existingJtCodes.length})
                </button>
              )}
            </div>
          </div>

          {/* Input Textarea for 10 Bill Codes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-900 flex items-center">
                Mã vận đơn (cách nhau bởi dấu phẩy, khoảng trắng hoặc dán link J&T):
              </label>
              <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                currentCodes.length === 10 
                  ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                  : currentCodes.length > 0 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {currentCodes.length}/10 mã
              </span>
            </div>

            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ví dụ: 862391601914, 862375230944, 862370960204, 862334748683... hoặc dán toàn bộ URL jtexpress.vn"
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 focus:outline-hidden bg-slate-50/50"
            />
          </div>

          {/* Recipient Phone Suffix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center bg-rose-50/40 p-3 rounded-xl border border-rose-100">
            <div>
              <label className="font-bold text-slate-900 block mb-0.5">
                4 số cuối SĐT người nhận:
              </label>
              <p className="text-[11px] text-slate-500">
                Mặc định <span className="font-mono font-bold text-rose-600">8836</span> hoặc <span className="font-mono font-bold text-rose-600">8036</span> để mở khóa chi tiết lộ trình trên J&T.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                maxLength={6}
                value={cellphone}
                onChange={(e) => setCellphone(e.target.value)}
                placeholder="8836"
                className="w-32 px-3 py-1.5 font-mono text-center font-bold text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <div className="flex space-x-1">
                <button
                  type="button"
                  onClick={() => setCellphone('8836')}
                  className={`px-2 py-1 text-[10px] font-bold rounded border cursor-pointer ${
                    cellphone === '8836' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  8836
                </button>
                <button
                  type="button"
                  onClick={() => setCellphone('8036')}
                  className={`px-2 py-1 text-[10px] font-bold rounded border cursor-pointer ${
                    cellphone === '8036' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  8036
                </button>
              </div>
            </div>
          </div>

          {/* Two Main Execution Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* Action 1: Open Official J&T Web in new tab */}
            <button
              type="button"
              onClick={handleOpenJNTWeb}
              disabled={currentCodes.length === 0}
              className="px-4 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition-all shadow-md shadow-rose-200 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Mở Trên Web J&T ({currentCodes.length} Đơn)</span>
            </button>

            {/* Action 2: Live API Query inside Modal */}
            <button
              type="button"
              onClick={handleLiveQuery}
              disabled={currentCodes.length === 0 || isLoading}
              className="px-4 py-2.5 rounded-xl font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 transition-all shadow-md shadow-amber-200 flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Đang Tra Cứu Live API...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-slate-900" />
                  <span>Tra Cứu Live API Ngay ({currentCodes.length} Đơn)</span>
                </>
              )}
            </button>
          </div>

          {/* Results Accordion Container */}
          {results && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-rose-600" />
                  <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] tracking-wider">
                    Kết Quả Tra Cứu Live API ({Object.keys(results).length} đơn)
                  </h4>
                </div>
                {onImportOrders && (
                  <button
                    type="button"
                    onClick={handleImportToTable}
                    className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm vào bảng theo dõi</span>
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {(Object.values(results) as JNTResultItem[]).map((item) => {
                  const isExpanded = Boolean(expandedCodes[item.code]);
                  const isCopied = copiedCode === item.code;

                  return (
                    <div
                      key={item.code}
                      className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs transition-all"
                    >
                      {/* Accordion Header */}
                      <div
                        onClick={() => toggleExpand(item.code)}
                        className="p-3 bg-slate-50/80 hover:bg-slate-100 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {item.code}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(item.code);
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                            title="Sao chép mã"
                          >
                            {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          </button>
                          {getStatusBadge(item.statusCategory, item.rawStatusText)}
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          {item.scannedAt && (
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold hidden sm:inline">
                              Quét lúc: {item.scannedAt}
                            </span>
                          )}
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-3.5 border-t border-slate-100 bg-white space-y-2.5">
                          {item.success ? (
                            <>
                              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                                <div className="font-semibold text-slate-800 text-xs">
                                  {item.rawStatusText}
                                </div>
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-mono">
                                  {item.recipientLocation && (
                                    <span>📍 Bưu cục: <strong className="text-slate-800">{item.recipientLocation}</strong></span>
                                  )}
                                  {item.updatedAt && (
                                    <span>🕒 Cập nhật: <strong className="text-slate-800">{item.updatedAt}</strong></span>
                                  )}
                                </div>
                              </div>

                              {/* Timeline list */}
                              {item.timeline && item.timeline.length > 0 && (
                                <div className="space-y-1.5 pt-1 pl-2 border-l-2 border-rose-200 ml-2">
                                  {item.timeline.map((step, sIdx) => (
                                    <div key={sIdx} className="relative pl-3 text-[11px]">
                                      <div className={`absolute -left-[13px] top-1.5 w-2 h-2 rounded-full ${
                                        sIdx === 0 ? 'bg-rose-600 ring-2 ring-rose-200' : 'bg-slate-300'
                                      }`} />
                                      <div className="font-mono text-[10px] text-slate-400">
                                        {step.time} {step.location ? `• ${step.location}` : ''}
                                      </div>
                                      <div className="text-slate-700 font-medium">
                                        {step.statusText}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="p-2.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-200 text-xs flex items-center space-x-2">
                              <AlertOctagon className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>{item.error || 'Chưa tìm thấy dữ liệu trên cổng J&T Express'}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            Đóng
          </button>

          {currentCodes.length > 0 && onImportOrders && (
            <button
              type="button"
              onClick={handleImportToTable}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Đưa {currentCodes.length} Đơn Vào Bảng Theo Dõi</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
