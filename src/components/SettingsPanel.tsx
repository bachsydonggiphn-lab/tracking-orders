import React, { useState, useEffect } from 'react';
import { SystemSettings, SyncLog } from '../types';
import { Settings, Shield, Bell, Volume2, HardDrive, RefreshCw, Trash2, Send, CheckCircle } from 'lucide-react';

interface Props {
  onSettingsChanged: (settings: SystemSettings) => void;
  syncInterval: number;
}

export default function SettingsPanel({ onSettingsChanged, syncInterval }: Props) {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Telegram test status
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [teleStatus, setTeleStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  // WMS test status
  const [testingWms, setTestingWms] = useState(false);
  const [wmsTestMessage, setWmsTestMessage] = useState<string>('');
  const [wmsTestStatus, setWmsTestStatus] = useState<'IDLE' | 'SUCCESS' | 'ERROR'>('IDLE');

  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSettings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch('/api/logs');
      const data = await response.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchLogs();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(true);
        onSettingsChanged(data.settings);
        setTimeout(() => setSuccess(false), 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!settings?.telegramBotToken || !settings?.telegramChatId) {
      alert("Vui lòng điền đủ Bot Token và Chat ID trước khi test!");
      return;
    }
    setTestingTelegram(true);
    setTeleStatus('IDLE');
    try {
      const response = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: `🔔 <b>[TEST] THÔNG BÁO THỬ NGHIỆM ĐỐI SOÁT KHO</b>\n\nHệ thống đối soát bưu phẩm (Reconciliation System) đang hoạt động tối ưu.\n\nNhà quản lý: David\nThời gian: ${new Date().toLocaleString('vi-VN')}`,
          parse_mode: 'HTML'
        })
      });
      const res = await response.json();
      if (res.ok) {
        setTeleStatus('SUCCESS');
      } else {
        setTeleStatus('ERROR');
      }
    } catch (err) {
      setTeleStatus('ERROR');
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleTestWms = async () => {
    if (!settings?.wmsUrl || !settings?.wmsUsername) {
      alert("Vui lòng điền đủ URL và Tài khoản WMS trước khi thử!");
      return;
    }
    setTestingWms(true);
    setWmsTestStatus('IDLE');
    setWmsTestMessage('');
    try {
      const response = await fetch('/api/settings/test-wms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      setWmsTestMessage(data.message);
      if (data.success) {
        setWmsTestStatus('SUCCESS');
      } else {
        setWmsTestStatus('ERROR');
      }
    } catch (err: any) {
      setWmsTestStatus('ERROR');
      setWmsTestMessage(`Lỗi kết nối: ${err.message}`);
    } finally {
      setTestingWms(false);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa sạch lịch sử log hệ thống?")) return;
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDB = async () => {
    if (!window.confirm("Cảnh báo: Thao tác này sẽ xóa toàn bộ lượt quét hiện tại và khôi phục dữ liệu demo ban đầu. Đồng ý?")) return;
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        alert("Khôi phục dữ liệu bưu kiện thành công!");
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !settings) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 flex justify-center items-center h-48">
        <div className="animate-spin text-indigo-600 font-bold">Đang tải cấu hình...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* COLUMN 1: FORM CONFIG */}
      <div className="lg:col-span-2 bg-white rounded-2xl shadow-xs border border-slate-100 p-5 flex flex-col justify-between">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">CẤU HÌNH HỆ THỐNG ĐỐI SOÁT</h2>
          </div>

          {/* WMS SERVER CREDENTIALS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Kết Nối WMS (YunWMS)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Đường dẫn WMS API Endpoint</label>
                <input
                  type="text"
                  value={settings.wmsUrl}
                  onChange={(e) => setSettings({ ...settings, wmsUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Tài khoản (WMS Username)</label>
                <input
                  type="text"
                  value={settings.wmsUsername}
                  onChange={(e) => setSettings({ ...settings, wmsUsername: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-semibold text-slate-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Mật khẩu (WMS Password)</label>
                <input
                  type="password"
                  placeholder="Mật khẩu"
                  value={settings.wmsPassword || ''}
                  onChange={(e) => setSettings({ ...settings, wmsPassword: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
            
            {/* WMS connection test button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestWms}
                disabled={testingWms}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingWms ? 'animate-spin' : ''}`} />
                {testingWms ? "Đang kiểm tra..." : "Kiểm Tra Đăng Nhập WMS"}
              </button>
              
              {wmsTestStatus === 'SUCCESS' && (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  <CheckCircle className="w-3.5 h-3.5" /> {wmsTestMessage || "Kết nối thành công!"}
                </span>
              )}
              {wmsTestStatus === 'ERROR' && (
                <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                  ⚠️ {wmsTestMessage || "Kết nối thất bại!"}
                </span>
              )}
            </div>
          </div>

          {/* BACKGROUND WORKER TIMERS */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500" /> Tiến Trình Đồng Bộ & Cảnh Báo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Chu kỳ quét bưu cục shipper (Giây)</label>
                <input
                  type="number"
                  min="5"
                  max="3600"
                  value={settings.syncIntervalSeconds}
                  onChange={(e) => setSettings({ ...settings, syncIntervalSeconds: parseInt(e.target.value) || 30 })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">Service ngầm tự động thăm dò J&T & SPX API theo chu kỳ</span>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Thời hạn cảnh báo đóng gói (Phút)</label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={settings.missingAlertThresholdMinutes}
                  onChange={(e) => setSettings({ ...settings, missingAlertThresholdMinutes: parseInt(e.target.value) || 30 })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-bold"
                />
                <span className="text-[9px] text-slate-400 mt-0.5 block">Tự động phát cảnh báo nếu bưu phẩm chưa gói sau X phút</span>
              </div>
            </div>
          </div>

          {/* TELEGRAM ALERTS */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-rose-500" /> Tích Hợp Telegram Bot Cảnh Báo Sót Hàng (Real integration)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Telegram Bot Token (HTTP API Token)</label>
                <input
                  type="password"
                  placeholder="Ví dụ: 7210438102:AAFv93X81LKm..."
                  value={settings.telegramBotToken}
                  onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-600"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold block mb-1">Telegram Chat ID (Cá nhân/Nhóm)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: -100987213810"
                  value={settings.telegramChatId}
                  onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 text-xs py-2 px-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>
            
            {/* Telegram testing button */}
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestTelegram}
                disabled={testingTelegram}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition"
              >
                <Send className="w-3.5 h-3.5" />
                {testingTelegram ? "Đang gửi thử..." : "Bắn Tin Nhắn Test Cảnh Báo"}
              </button>
              
              {teleStatus === 'SUCCESS' && (
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Gửi test thành công! Hãy kiểm tra điện thoại của bạn.
                </span>
              )}
              {teleStatus === 'ERROR' && (
                <span className="text-[10px] text-rose-600 font-semibold">
                  ⚠️ Thất bại! Hãy kiểm tra lại Token & Chat ID.
                </span>
              )}
            </div>
          </div>

          {/* AUDIO SYNTHESIZER PREFERENCES */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> Tùy chọn Âm thanh tại trạm quét
            </h3>
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
              <input
                type="checkbox"
                checked={settings.enableSoundEffects}
                onChange={(e) => setSettings({ ...settings, enableSoundEffects: e.target.checked })}
                className="rounded border-slate-200 text-indigo-600 focus:ring-0"
              />
              Kích hoạt phát âm bíp / buzz khi quét thành công hoặc quét lỗi (Web Audio API)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-5">
            {success && (
              <span className="text-xs text-emerald-600 font-semibold animate-pulse">
                ✓ Lưu cấu hình thành công!
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "ÁP DỤNG CÀI ĐẶT"}
            </button>
          </div>
        </form>

        {/* SYSTEM RESET HARD DRIVE DANGEROUS BUTTON */}
        <div className="border-t border-slate-100 mt-6 pt-4 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-700">Khôi phục & dọn dẹp bộ nhớ đệm</h4>
            <p className="text-[10px] text-slate-400">Đặt lại bưu kiện về trạng thái demo ban đầu</p>
          </div>
          <button
            onClick={handleResetDB}
            className="inline-flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold py-1.5 px-3 rounded-lg text-[11px] transition border border-rose-200"
          >
            <Trash2 className="w-3.5 h-3.5" /> Khôi Phục Dữ Liệu Demo
          </button>
        </div>

      </div>

      {/* COLUMN 2: REAL-TIME SYSTEM ENGINE SYNC LOGS FEED */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-xs border border-slate-800 p-5 flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4.5 h-4.5 text-emerald-400" />
            <h3 className="text-sm font-bold">LOGS ĐỒNG BỘ REALTIME</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchLogs}
              disabled={logsLoading}
              className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-1 rounded hover:bg-slate-700"
            >
              Tải lại
            </button>
            {logs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="text-[10px] bg-rose-950/50 text-rose-400 font-bold px-2 py-1 rounded hover:bg-rose-900/50 border border-rose-900/30"
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* LOGS WINDOW */}
        <div className="flex-1 overflow-y-auto max-h-[480px] space-y-3 pr-1 font-mono text-[11px] scrollbar-thin">
          {logsLoading && logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 italic">Đang tải lịch sử logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 italic">
              Không có log hoạt động nào được ghi nhận.
              <br />
              <span className="text-[10px] text-slate-600 block mt-2">Các lượt quét đóng gói và đồng bộ bưu phẩm sẽ được in ra tại đây.</span>
            </div>
          ) : (
            logs.map((log) => {
              const time = new Date(log.timestamp).toLocaleTimeString('vi-VN');
              const isAlert = log.type === 'ALERT_TRIGGERED';
              const isWarning = log.status === 'WARNING';
              const isFailed = log.status === 'FAILED';

              return (
                <div 
                  key={log.id} 
                  className={`p-2.5 rounded-xl border ${
                    isAlert 
                      ? 'bg-rose-950/40 border-rose-900 text-rose-300' 
                      : isWarning 
                        ? 'bg-amber-950/20 border-amber-900/50 text-amber-300' 
                        : isFailed
                          ? 'bg-red-950/40 border-red-900 text-red-300'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between font-bold border-b border-slate-800/50 pb-1 mb-1 text-[10px]">
                    <span className={isAlert ? 'text-rose-400' : 'text-slate-400'}>
                      [{log.type}]
                    </span>
                    <span className="text-slate-500">{time}</span>
                  </div>
                  <p className="font-semibold leading-relaxed">{log.message}</p>
                  {log.details && (
                    <p className="text-[10px] text-slate-500 mt-1 pl-1 border-l border-slate-700">
                      {log.details}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
