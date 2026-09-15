import React, { useState, useRef } from 'react';
import { 
  Clipboard, 
  FileSpreadsheet, 
  Upload, 
  Sparkles, 
  Check, 
  Trash2, 
  Info,
  Plus,
  RefreshCw,
  Zap,
  RotateCcw,
  CloudDownload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { CarrierId } from '../types/tracking';
import { CARRIERS } from '../services/carrierDetector';
import { generateSampleCodes } from '../services/sampleData';

interface ImportAreaProps {
  onImport: (codes: string[], forcedCarrier?: CarrierId, extraData?: any[]) => void;
  onAppendImport?: (codes: string[], forcedCarrier?: CarrierId, extraData?: any[]) => void;
  onImportFullOrders?: (orders: any[]) => void;
  onClearAll?: () => void;
  onOpenYunWMS?: () => void;
  onOpenJNT10Modal?: () => void;
  currentCount?: number;
  isProcessing: boolean;
  jtPhoneSuffix: string;
  onJtPhoneSuffixChange: (val: string) => void;
}

export const ImportArea: React.FC<ImportAreaProps> = ({ 
  onImport, 
  onAppendImport,
  onImportFullOrders,
  onClearAll,
  onOpenYunWMS,
  onOpenJNT10Modal,
  currentCount = 0,
  isProcessing,
  jtPhoneSuffix,
  onJtPhoneSuffixChange
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file'>('paste');
  const [rawText, setRawText] = useState('');
  const [forcedCarrier, setForcedCarrier] = useState<CarrierId>('unknown');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper parser for pasted text / URLs / delimited lines
  const parseRawInput = (text: string) => {
    const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
    const codes: string[] = [];
    const extraList: any[] = [];

    for (const line of lines) {
      if (line.toLowerCase().startsWith('mã') || line.toLowerCase().startsWith('stt')) continue;

      // 1. URL parsing (supports multi-code URLs e.g. J&T or SPX URLs e.g. https://spx.vn/track?SPXVN062371495019)
      if (line.includes('spx.vn')) {
        let decoded = line;
        try { decoded = decodeURIComponent(line); } catch {}
        const spxCodeMatch = decoded.match(/(?:track\?|billcode=|\/|\?)(SPXVN[A-Z0-9]+|SPX[A-Z0-9]+|VNSPX[A-Z0-9]+)/i);
        if (spxCodeMatch) {
          codes.push(spxCodeMatch[1].toUpperCase());
          extraList.push(undefined);
          continue;
        }
      }

      if (line.includes('billcode=') || line.includes('order_code=') || line.includes('order_number=') || line.includes('bills=') || line.includes('jtexpress.vn')) {
        let decoded = line;
        try {
          decoded = decodeURIComponent(line);
        } catch {}

        const pMatch = decoded.match(/(?:cellphone|phone|tel)=(\d+)/i);
        const urlPhone = pMatch ? pMatch[1] : '';

        const bMatch = decoded.match(/(?:billcode|order_code|order_number|id|bills|key)=([^&]+)/i);
        if (bMatch) {
          const rawCodes = bMatch[1].split(/[,\s\r\n]+/).map(c => c.replace(/[^a-zA-Z0-9_-]/g, '').trim()).filter(Boolean);
          for (const c of rawCodes) {
            if (c.length >= 4) {
              codes.push(c);
              extraList.push(urlPhone ? { customerPhone: urlPhone } : undefined);
            }
          }
          continue;
        }
      }

      // 2. Delimited lines (Tab, Comma, Semicolon, Pipe)
      const parts = line.split(/[\t,;|]+/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 2) {
        // Multiple comma/tab-separated tracking codes on one line
        for (const p of parts) {
          const cleanP = p.replace(/[^a-zA-Z0-9_-]/g, '').trim();
          if (cleanP.length >= 4) {
            codes.push(cleanP);
            extraList.push(undefined);
          }
        }
      } else if (parts.length === 2) {
        // Could be "code phone" or two codes
        if (/^\d{4,6}$/.test(parts[1]) && !parts[0].startsWith('0')) {
          codes.push(parts[0]);
          extraList.push({ customerPhone: parts[1] });
        } else {
          const c0 = parts[0].replace(/[^a-zA-Z0-9_-]/g, '').trim();
          const c1 = parts[1].replace(/[^a-zA-Z0-9_-]/g, '').trim();
          if (c0.length >= 4) {
            codes.push(c0);
            extraList.push(undefined);
          }
          if (c1.length >= 4) {
            codes.push(c1);
            extraList.push(undefined);
          }
        }
      } else {
        // 3. Space-separated e.g. "862293530154 8036"
        const spaceParts = line.split(/\s+/).map(p => p.trim()).filter(Boolean);
        if (spaceParts.length === 2 && /^\d{4,6}$/.test(spaceParts[1])) {
          codes.push(spaceParts[0]);
          extraList.push({ customerPhone: spaceParts[1] });
        } else {
          const cleanCode = line.replace(/[^a-zA-Z0-9_-]/g, '').trim();
          if (cleanCode.length >= 4) {
            codes.push(cleanCode);
            extraList.push(undefined);
          }
        }
      }
    }

    return { codes, extraList };
  };

  const { codes: parsedCodes, extraList: parsedExtra } = parseRawInput(rawText);

  // 1. Submit by replacing everything (Clear old data & Import new)
  const handleReplaceSubmit = () => {
    if (parsedCodes.length === 0) return;
    onImport(parsedCodes, forcedCarrier, parsedExtra);
  };

  // 2. Submit by appending to existing list
  const handleAppendSubmit = () => {
    if (parsedCodes.length === 0) return;
    if (onAppendImport) {
      onAppendImport(parsedCodes, forcedCarrier, parsedExtra);
    } else {
      onImport(parsedCodes, forcedCarrier, parsedExtra);
    }
  };

  // 3. One-click Paste from Clipboard & Scan Immediately (Replaces old data)
  const handleDirectPasteAndScan = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        alert('Clipboard hiện đang trống. Hãy sao chép cột mã vận đơn hoặc link tra cứu trước!');
        return;
      }
      setRawText(text);
      const { codes, extraList } = parseRawInput(text);

      if (codes.length > 0) {
        onImport(codes, forcedCarrier, extraList);
      }
    } catch (e) {
      console.warn('Could not read clipboard', e);
    }
  };

  const handlePasteFromClipboardOnly = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
      }
    } catch (e) {
      console.warn('Could not read clipboard', e);
    }
  };

  const handleClearAllAndInput = () => {
    setRawText('');
    setFileName(null);
    if (onClearAll) {
      onClearAll();
    }
  };

  const handleLoadSample = (count: number) => {
    const sample = generateSampleCodes(count);
    const codes = sample.map(s => s.code);
    setRawText(codes.join('\n'));
    onImport(codes, 'unknown', sample);
  };

  const processExcelFile = async (file: File) => {
    setFileName(file.name);

    // Support JSON format backup/state restore
    if (file.name.toLowerCase().endsWith('.json') || file.type.includes('json')) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const orderList = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.orders) ? parsed.orders : null);
        if (orderList && orderList.length > 0) {
          if (onImportFullOrders) {
            onImportFullOrders(orderList);
            return;
          } else {
            const codes = orderList.map((o: any) => o.trackingCode || o.code).filter(Boolean);
            if (codes.length > 0) {
              onImport(codes, forcedCarrier, orderList);
              return;
            }
          }
        }
      } catch (jsonErr) {
        console.error('Error parsing JSON backup file', jsonErr);
        alert('Không thể đọc file JSON. Vui lòng kiểm tra file JSON hợp lệ.');
        return;
      }
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const json: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const extractedCodes: string[] = [];
      const extraInfo: any[] = [];

      for (let r = 0; r < json.length; r++) {
        const row = json[r];
        if (!Array.isArray(row) || row.length === 0) continue;

        // Try to find the column that looks like tracking code (GY..., SPXVN..., 86..., VT...)
        let codeFound = '';
        let shopName = '';
        let phone = '';

        for (let col = 0; col < row.length; col++) {
          const val = String(row[col] || '').trim();
          if (!val) continue;

          // Check if string looks like a tracking code
          if (
            val.toUpperCase().startsWith('GY') || 
            val.toUpperCase().startsWith('SPXVN') || 
            val.toUpperCase().startsWith('86') || 
            val.toUpperCase().startsWith('G8') ||
            val.toUpperCase().startsWith('VT') ||
            val.toUpperCase().startsWith('NIVN') ||
            (val.length >= 8 && /^[a-zA-Z0-9_-]+$/.test(val) && !val.includes(' ') && !/^[0-9]{1,3}$/.test(val))
          ) {
            codeFound = val;
          } else if (val.length >= 9 && val.length <= 11 && /^(0[3|5|7|8|9])[0-9]{8}$/.test(val)) {
            phone = val;
          } else if (val.length > 2 && !codeFound && isNaN(Number(val))) {
            shopName = val;
          }
        }

        // If no format matched, take first non-empty cell in row if not header
        if (!codeFound && row[0] && String(row[0]).trim().length > 3) {
          const firstVal = String(row[0]).trim();
          if (!firstVal.toLowerCase().includes('mã') && !firstVal.toLowerCase().includes('tracking') && !firstVal.toLowerCase().includes('stt')) {
            codeFound = firstVal;
          }
        }

        if (codeFound) {
          extractedCodes.push(codeFound);
          extraInfo.push({ shopName, customerPhone: phone, phone });
        }
      }

      if (extractedCodes.length > 0) {
        setRawText(extractedCodes.join('\n'));
        // Default: replace old data with new Excel list
        onImport(extractedCodes, forcedCarrier, extraInfo);
      }
    } catch (err) {
      console.error('Error parsing Excel file', err);
      alert('Không thể đọc file Excel. Vui lòng kiểm tra định dạng .xlsx / .csv');
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Tab Navigation & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 bg-slate-50 px-4 sm:px-6 py-2.5 gap-2.5">
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setActiveTab('paste')}
            className={`inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Clipboard className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Dán cột Excel / Mã vận đơn
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'file'
                ? 'bg-white text-slate-900 shadow-2xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
            Tải file Excel / CSV (.xlsx)
          </button>
          {onOpenYunWMS && (
            <button
              onClick={onOpenYunWMS}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 shadow-2xs"
              title="Cấu hình tài khoản, kho hàng & xem từ điển đầu mã YunWMS"
            >
              <CloudDownload className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Cài đặt WMS Cloud
            </button>
          )}
        </div>

        {/* Carrier override selector & Clear List Button */}
        <div className="flex flex-wrap items-center gap-2">
          {/* J&T Phone Suffix Auto Configured */}
          <div className="inline-flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg shadow-2xs" title="Hệ thống tự động sử dụng đuôi SĐT 8836 để mở khóa cổng J&T Express">
            <span className="text-[11px] font-bold text-rose-700 font-mono">J&T Đuôi SĐT:</span>
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-mono font-bold rounded bg-rose-600 text-white shadow-2xs">
              8836 (Tự động)
            </span>
          </div>

          {currentCount > 0 && (
            <button
              onClick={handleClearAllAndInput}
              className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              title="Xóa sạch dữ liệu trong bảng hiện tại"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Xóa sạch ({currentCount.toLocaleString()} đơn)
            </button>
          )}

          <select
            value={forcedCarrier}
            onChange={(e) => setForcedCarrier(e.target.value as CarrierId)}
            className="text-xs font-semibold bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 cursor-pointer"
          >
            <option value="unknown">⚡ Tự động nhận diện hãng (Khuyên dùng)</option>
            <option value="ghn">Giao Hàng Nhanh (GY...)</option>
            <option value="spx">Shopee Express (SPXVN...)</option>
            <option value="jt">J&T Express (8622...)</option>
            <option value="viettelpost">Viettel Post</option>
            <option value="ninjavan">Ninja Van</option>
          </select>
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'paste' ? (
          <div>
            <div className="relative">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Dán danh sách mã vận đơn vào đây (mỗi dòng 1 mã, hỗ trợ link https://spx.vn/track?SPXVN... hoặc copy từ Excel)...&#10;Ví dụ:&#10;SPXVN062371495019&#10;GY8X37DK&#10;862223810444&#10;SPXVN068285466948"
                rows={6}
                className="w-full text-xs font-mono p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-400 text-slate-900"
              />

              {rawText && (
                <div className="absolute top-2.5 right-2.5 flex items-center space-x-1">
                  <button
                    onClick={() => setRawText('')}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Xóa trắng ô nhập"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions for Paste Mode */}
            <div className="mt-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              
              {/* Left quick paste helpers */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDirectPasteAndScan}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  title="Tự động đọc Clipboard, xóa dữ liệu cũ và bắt đầu quét ngay"
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                  Dán Clipboard & Quét mới
                </button>

                <button
                  type="button"
                  onClick={handlePasteFromClipboardOnly}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Clipboard className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                  Dán vào ô
                </button>

                {onOpenJNT10Modal && (
                  <button
                    type="button"
                    onClick={onOpenJNT10Modal}
                    className="inline-flex items-center px-2.5 py-1.5 text-xs font-bold text-rose-850 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    title="Mở bảng tra cứu 1 lần 10 đơn hàng trên J&T Express"
                  >
                    <span className="px-1 py-0.2 mr-1 rounded text-[10px] bg-rose-600 text-white font-mono font-black">
                      10
                    </span>
                    Tra cứu 10 đơn J&T
                  </button>
                )}

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                <span className="text-xs text-slate-600 font-medium">
                  Đã nhận: <strong className="text-slate-900 font-bold font-mono">{parsedCodes.length.toLocaleString()}</strong> mã
                </span>

                <div className="h-4 w-px bg-slate-200 hidden sm:block" />

                {/* Sample Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">Mẫu:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const sample = [
                        { code: '862223810444', carrierHint: 'jt' as CarrierId, shopName: 'ĐGP Bình Dương', phone: '0909888036', orderDate: '23/08/2026' },
                        { code: '862206170444', carrierHint: 'jt' as CarrierId, shopName: 'ĐGP Bình Dương', phone: '0909888036', orderDate: '23/08/2026' },
                        { code: 'GY8X37DK', carrierHint: 'ghn' as CarrierId, shopName: 'Shop Sài Gòn', phone: '0988008036', orderDate: '23/08/2026' },
                        { code: 'SPXVN068285466948', carrierHint: 'spx' as CarrierId, shopName: 'Shopee Store', phone: '0912345678', orderDate: '23/08/2026' }
                      ];
                      const codes = sample.map(s => s.code);
                      setRawText(codes.join('\n'));
                      onImport(codes, 'unknown', sample);
                    }}
                    className="text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 font-bold px-2 py-0.5 rounded transition-colors cursor-pointer font-mono"
                    title="Nạp các mã thực tế: J&T, GHN, SPX"
                  >
                    ⭐ Mã mẫu thực tế
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(50)}
                    className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer font-mono"
                  >
                    50 đơn
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample(200)}
                    className="text-xs text-slate-700 hover:text-slate-900 font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer font-mono"
                  >
                    200 đơn
                  </button>
                </div>
              </div>

              {/* Right Execution Buttons: Replace vs Append */}
              <div className="flex items-center space-x-2">
                {currentCount > 0 && parsedCodes.length > 0 && (
                  <button
                    disabled={isProcessing}
                    onClick={handleAppendSubmit}
                    className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-all cursor-pointer font-sans"
                    title="Thêm danh sách này vào phía sau dữ liệu hiện có"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                    Dán thêm ({parsedCodes.length.toLocaleString()} đơn)
                  </button>
                )}

                <button
                  disabled={parsedCodes.length === 0 || isProcessing}
                  onClick={handleReplaceSubmit}
                  className="inline-flex items-center justify-center px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 active:bg-black disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer font-sans"
                  title="Xóa dữ liệu cũ và quét lô mới này"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  {currentCount > 0 ? 'Xóa cũ & Quét mới' : 'Kiểm tra'} {parsedCodes.length > 0 ? `(${parsedCodes.length.toLocaleString()} đơn)` : ''}
                </button>
              </div>

            </div>
          </div>
        ) : (
          <div>
            {/* File Dropzone */}
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragActive 
                  ? 'border-slate-800 bg-slate-50' 
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .json"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    processExcelFile(e.target.files[0]);
                  }
                }}
              />

              <div className="w-12 h-12 rounded-lg bg-slate-900 text-white mx-auto flex items-center justify-center mb-3 shadow-xs">
                <Upload className="w-6 h-6 text-emerald-400" />
              </div>

              <div className="text-sm font-bold text-slate-900">
                Kéo thả file Excel (.xlsx, .xls), CSV hoặc file JSON trạng thái vào đây
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Hệ thống tự động nhận diện mã vận đơn hoặc khôi phục 100% trạng thái quét từ file JSON
              </p>

              {fileName && (
                <div className="mt-3 inline-flex items-center px-3 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                  <Check className="w-3 h-3 mr-1" /> File: {fileName}
                </div>
              )}
            </div>

            {/* Helper footer */}
            <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center font-medium">
                <Info className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                Hỗ trợ file danh sách xuất từ Shopee, TikTok Shop, Lazada, Pancake, PosCake, Nhanh.vn, Sapo
              </span>
              <button
                type="button"
                onClick={() => handleLoadSample(200)}
                className="text-slate-800 hover:text-slate-900 underline font-semibold self-start sm:self-auto cursor-pointer"
              >
                Dùng thử file mẫu 200 đơn
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
