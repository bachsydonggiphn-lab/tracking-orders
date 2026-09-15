/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { ImportArea } from './components/ImportArea';
import { BatchControls } from './components/BatchControls';
import { OrderTable } from './components/OrderTable';
import { OrderDetailModal } from './components/OrderDetailModal';
import { CarrierGuideModal } from './components/CarrierGuideModal';
import { YunWMSSyncModal } from './components/YunWMSSyncModal';
import { JNTMultiTrackModal } from './components/JNTMultiTrackModal';
import { AutoSyncBar } from './components/AutoSyncBar';
import { BatchStats, CarrierId, OrderItem, TrackingProgressMetrics, TrackingStatusCategory } from './types/tracking';
import { createOrderItem, trackSingleOrder, trackBatchOrders, clearTrackingCache } from './services/trackingService';
import { detectCarrier, getDirectTrackingUrl } from './services/carrierDetector';
import { isOrderWithinDays, getOrderAgeInfo } from './utils/dateFilter';
import { getInitialOrdersSync, loadIndexedDBOrders, loadPersistedOrders, saveOrdersDebounced, saveOrdersToStorage, clearPersistedOrders, normalizeOrderList, upsertOrdersToSql } from './utils/orderStorage';
import { fetchLatestWMSOrders } from './utils/wmsOrderUtils';
import { CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function App() {
  const [orders, setOrders] = useState<OrderItem[]>(() => {
    return getInitialOrdersSync();
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [concurrency, setConcurrency] = useState(50);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<OrderItem | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showYunWMSModal, setShowYunWMSModal] = useState(false);
  const [showJNT10Modal, setShowJNT10Modal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [trackingMetrics, setTrackingMetrics] = useState<TrackingProgressMetrics | null>(null);
  const [activeScanScope, setActiveScanScope] = useState<'all' | '3days' | '7days' | '14days' | 'unscanned'>('all');
  const [jtPhoneSuffix, setJtPhoneSuffix] = useState<string>('8836');
  const [isLoadingFromDb, setIsLoadingFromDb] = useState(false);

  // Auto Sync & Real-time Scan State
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('auto_sync_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [autoSyncInterval, setAutoSyncInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('auto_sync_interval');
      return saved ? parseInt(saved, 10) : 30; // default 30s
    } catch {
      return 30;
    }
  });
  const [autoSyncCountdown, setAutoSyncCountdown] = useState<number>(autoSyncInterval);
  const [isAutoSyncing, setIsAutoSyncing] = useState<boolean>(false);
  const [lastAutoSyncTime, setLastAutoSyncTime] = useState<Date | null>(null);
  const [lastAutoSyncAddedCount, setLastAutoSyncAddedCount] = useState<number>(0);
  const isAutoSyncingRef = useRef<boolean>(false);

  const ordersRef = useRef<OrderItem[]>(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const handleJtPhoneSuffixChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 4);
    setJtPhoneSuffix(clean);
    try {
      localStorage.setItem('jt_phone_suffix', clean);
    } catch {}
  };

  // Cancellation token ref for stopping batch queue
  const isStoppingRef = useRef(false);
  const isRunningRef = useRef(false);

  // Persist to IndexedDB with debouncing (no LocalStorage quota errors)
  useEffect(() => {
    if (orders.length > 0) {
      saveOrdersDebounced(orders, 600);
    }
  }, [orders]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  // Compute overall stats
  const stats: BatchStats = useMemo(() => {
    const total = orders.length;
    let checked = 0;
    let scanned = 0;
    let notScanned = 0;
    let unscanned1Day = 0;
    let unscanned2Days = 0;
    let unscanned3PlusDays = 0;
    let cancelled = 0;
    let inTransit = 0;
    let delivered = 0;
    let returned = 0;
    let error = 0;

    for (let i = 0; i < total; i++) {
      const o = orders[i];
      const isChecked = !o.isChecking && (
        o.statusCategory !== 'not_scanned' || 
        (Boolean(o.updatedAt) && !o.rawStatusText?.includes('(Chưa scan)') && o.rawStatusText !== 'Chưa kiểm tra' && o.rawStatusText !== 'Chờ kiểm tra Live API')
      );
      if (isChecked) {
        checked++;
      }
      switch (o.statusCategory) {
        case 'scanned': scanned++; break;
        case 'not_scanned': {
          notScanned++;
          const age = getOrderAgeInfo(o);
          if (age.category === '1day') unscanned1Day++;
          else if (age.category === '2days') unscanned2Days++;
          else unscanned3PlusDays++;
          break;
        }
        case 'cancelled': cancelled++; break;
        case 'in_transit': inTransit++; break;
        case 'delivered': delivered++; break;
        case 'returned': returned++; break;
        case 'error': error++; break;
      }
    }

    const percentComplete = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;
    const scannedRate = total > 0 ? Math.round(((scanned + inTransit + delivered) / total) * 100) : 0;

    return {
      total,
      checked,
      scanned,
      notScanned,
      unscanned1Day,
      unscanned2Days,
      unscanned3PlusDays,
      cancelled,
      inTransit,
      delivered,
      returned,
      error,
      percentComplete,
      scannedRate
    };
  }, [orders]);

  // Filtered orders for table rendering
  const filteredOrders = useMemo(() => {
    return orders.filter(item => {
      // 1. Status category filter
      if (selectedStatus === 'not_scanned' && item.statusCategory !== 'not_scanned') return false;
      if (selectedStatus === 'unscanned_1day') {
        if (item.statusCategory !== 'not_scanned') return false;
        if (getOrderAgeInfo(item).category !== '1day') return false;
      }
      if (selectedStatus === 'unscanned_2days') {
        if (item.statusCategory !== 'not_scanned') return false;
        if (getOrderAgeInfo(item).category !== '2days') return false;
      }
      if (selectedStatus === 'unscanned_3days') {
        if (item.statusCategory !== 'not_scanned') return false;
        if (getOrderAgeInfo(item).category !== '3plus_days') return false;
      }
      if (selectedStatus === 'scanned') {
        const isScannedOrDone = item.statusCategory === 'scanned' || item.statusCategory === 'in_transit' || item.statusCategory === 'delivered';
        if (!isScannedOrDone) return false;
      }
      if (selectedStatus === 'cancelled' && item.statusCategory !== 'cancelled') return false;
      if (selectedStatus === 'in_transit' && item.statusCategory !== 'in_transit') return false;
      if (selectedStatus === 'delivered' && item.statusCategory !== 'delivered') return false;
      if (selectedStatus === 'error' && item.statusCategory !== 'error') return false;

      // 2. Carrier filter
      if (selectedCarrier !== 'all') {
        if (selectedCarrier === 'jt_cargo') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isCargo = item.carrier === 'jt_cargo' || (item.carrier === 'jt' && (code.startsWith('530') || code.startsWith('53')));
          if (!isCargo) return false;
        } else if (selectedCarrier === 'jt_express') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isExpress = item.carrier === 'jt' && !code.startsWith('530') && !code.startsWith('53');
          if (!isExpress) return false;
        } else if (selectedCarrier === 'jt') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isJT = item.carrier === 'jt' || item.carrier === 'jt_cargo' || code.startsWith('8') || code.startsWith('53');
          if (!isJT) return false;
        } else if (selectedCarrier === 'vnpost') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isVnpost = item.carrier === 'vnpost' || code.startsWith('EMS') || code.startsWith('VNPOST') || /^[A-Z]{2}\d{8,11}VN$/i.test(code);
          if (!isVnpost) return false;
        } else if (selectedCarrier === 'best') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isBest = item.carrier === 'best' || code.startsWith('BEST') || ((code.startsWith('61') || code.startsWith('81')) && code.length === 12 && /^\d+$/.test(code));
          if (!isBest) return false;
        } else if (selectedCarrier === 'other') {
          const code = (item.trackingCode || '').trim().toUpperCase();
          const isVnpost = item.carrier === 'vnpost' || code.startsWith('EMS') || code.startsWith('VNPOST') || /^[A-Z]{2}\d{8,11}VN$/i.test(code);
          const isBest = item.carrier === 'best' || code.startsWith('BEST') || ((code.startsWith('61') || code.startsWith('81')) && code.length === 12 && /^\d+$/.test(code));
          if (isVnpost || isBest || ['spx', 'jt', 'jt_cargo', 'ghn', 'viettelpost', 'ninjavan', 'tiktok', 'lex', 'ghtk'].includes(item.carrier)) return false;
        } else if (item.carrier !== selectedCarrier) {
          return false;
        }
      }

      // 3. Search text
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const codeMatch = item.trackingCode.toLowerCase().includes(query);
        const orderNoMatch = item.orderNo?.toLowerCase().includes(query) ?? false;
        const refNoMatch = item.refNo?.toLowerCase().includes(query) ?? false;
        const shopMatch = item.extraInfo?.shopName?.toLowerCase().includes(query) ?? false;
        const phoneMatch = item.extraInfo?.customerPhone?.toLowerCase().includes(query) ?? false;
        const statusMatch = item.rawStatusText.toLowerCase().includes(query);
        const warehouseMatch = item.warehouseName?.toLowerCase().includes(query) ?? false;
        if (!codeMatch && !orderNoMatch && !refNoMatch && !shopMatch && !phoneMatch && !statusMatch && !warehouseMatch) {
          return false;
        }
      }

      return true;
    });
  }, [orders, selectedStatus, selectedCarrier, searchTerm]);

  /**
   * Handle batch import of new codes (replaces old list)
   */
  const handleImport = (
    codes: string[], 
    forcedCarrier?: CarrierId, 
    extraData?: any[]
  ) => {
    // Stop any existing job
    isStoppingRef.current = true;
    setIsProcessing(false);

    const newOrders: OrderItem[] = codes.map((code, idx) => {
      const extra = extraData && extraData[idx] ? extraData[idx] : undefined;
      return createOrderItem(code, idx + 1, extra, forcedCarrier);
    });

    setOrders(newOrders);
    ordersRef.current = newOrders;
    showToast(`Đã nạp ${newOrders.length.toLocaleString()} mã vận đơn. Đang tự động kiểm tra...`);

    // Auto trigger batch tracking
    setTimeout(() => {
      startBatchExecution(newOrders, 'all');
    }, 150);
  };

  /**
   * Append codes to existing list
   */
  const handleAppendImport = (
    codes: string[],
    forcedCarrier?: CarrierId,
    extraData?: any[]
  ) => {
    const currentBase = ordersRef.current.length > 0 ? ordersRef.current : orders;
    const currentLen = currentBase.length;
    const addedOrders: OrderItem[] = codes.map((code, idx) => {
      const extra = extraData && extraData[idx] ? extraData[idx] : undefined;
      return createOrderItem(code, currentLen + idx + 1, extra, forcedCarrier);
    });

    const combined = [...currentBase, ...addedOrders];
    setOrders(combined);
    ordersRef.current = combined;
    showToast(`Đã thêm ${addedOrders.length.toLocaleString()} mã. Tổng: ${combined.length.toLocaleString()} đơn. Đang tự động kiểm tra...`);

    setTimeout(() => {
      startBatchExecution(combined, 'unscanned');
    }, 150);
  };

  /**
   * Core high-throughput worker pool execution with real-time speed & ETA
   */
  const startBatchExecution = async (
    targetOrders?: OrderItem[], 
    scope: 'all' | '3days' | '7days' | '14days' | 'unscanned' | 'unscanned_1day' | 'unscanned_2days' | 'unscanned_3days' = 'all'
  ) => {
    const currentOrders = ordersRef.current;
    if (!currentOrders || currentOrders.length === 0) {
      if (targetOrders && targetOrders.length > 0) {
        ordersRef.current = targetOrders;
        setOrders(targetOrders);
      } else {
        setIsProcessing(false);
        isRunningRef.current = false;
        return;
      }
    }

    if (isRunningRef.current) {
      isStoppingRef.current = true;
      await new Promise(r => setTimeout(r, 120));
    }

    isRunningRef.current = true;
    isStoppingRef.current = false;
    setIsProcessing(true);
    setActiveScanScope(scope);

    const queueIndices: number[] = [];
    const isSubsetTarget = Boolean(
      targetOrders && 
      targetOrders.length > 0 && 
      ordersRef.current.length > 0 && 
      targetOrders.length < ordersRef.current.length
    );

    if (isSubsetTarget) {
      const targetCodes = new Set(targetOrders!.map(o => (o.trackingCode || '').trim().toUpperCase()));
      ordersRef.current.forEach((item, index) => {
        const clean = (item.trackingCode || '').trim().toUpperCase();
        if (targetCodes.has(clean)) {
          queueIndices.push(index);
        }
      });
    } else {
      ordersRef.current.forEach((item, index) => {
        if (scope === 'unscanned') {
          if (item.statusCategory === 'not_scanned' || item.rawStatusText === 'Chưa kiểm tra' || item.rawStatusText === 'Chờ kiểm tra Live API') {
            queueIndices.push(index);
          }
        } else if (scope === 'unscanned_1day') {
          if (item.statusCategory === 'not_scanned' || item.rawStatusText === 'Chưa kiểm tra' || item.rawStatusText === 'Chờ kiểm tra Live API') {
            if (getOrderAgeInfo(item).category === '1day') queueIndices.push(index);
          }
        } else if (scope === 'unscanned_2days') {
          if (item.statusCategory === 'not_scanned' || item.rawStatusText === 'Chưa kiểm tra' || item.rawStatusText === 'Chờ kiểm tra Live API') {
            if (getOrderAgeInfo(item).category === '2days') queueIndices.push(index);
          }
        } else if (scope === 'unscanned_3days') {
          if (item.statusCategory === 'not_scanned' || item.rawStatusText === 'Chưa kiểm tra' || item.rawStatusText === 'Chờ kiểm tra Live API') {
            if (getOrderAgeInfo(item).category === '3plus_days') queueIndices.push(index);
          }
        } else if (scope === '3days') {
          if (isOrderWithinDays(item, 3)) queueIndices.push(index);
        } else if (scope === '7days') {
          if (isOrderWithinDays(item, 7)) queueIndices.push(index);
        } else if (scope === '14days') {
          if (isOrderWithinDays(item, 14)) queueIndices.push(index);
        } else {
          queueIndices.push(index);
        }
      });
    }

    if (queueIndices.length === 0) {
      setIsProcessing(false);
      isRunningRef.current = false;
      showToast('Không có đơn hàng nào cần quét trong khoảng thời gian đã chọn!');
      return;
    }

    let completedCount = 0;
    const startTime = Date.now();
    const totalInQueue = queueIndices.length;

    const updateMetrics = () => {
      const elapsedSec = Math.max(0.05, (Date.now() - startTime) / 1000);
      const speed = completedCount / elapsedSec; // items per second
      const percent = totalInQueue > 0 ? Math.min(100, Math.round((completedCount / totalInQueue) * 100)) : 100;
      const remaining = Math.max(0, totalInQueue - completedCount);
      const etaSec = speed > 0 ? Math.ceil(remaining / speed) : 0;
      
      let etaFormatted = 'Đang tính...';
      if (remaining === 0) {
        etaFormatted = 'Đã hoàn tất';
      } else if (etaSec < 60) {
        etaFormatted = `còn ~${etaSec}s`;
      } else {
        const m = Math.floor(etaSec / 60);
        const s = etaSec % 60;
        etaFormatted = `còn ~${m}p ${s}s`;
      }

      setTrackingMetrics({
        startTime,
        total: totalInQueue,
        completed: completedCount,
        percent,
        speed,
        estimatedSecondsLeft: etaSec,
        etaFormatted
      });
    };

    updateMetrics();

    // High-speed throttled UI sync (runs smoothly at ~3fps / 350ms to prevent UI flicker)
    const flushInterval = setInterval(() => {
      if (ordersRef.current) {
        setOrders([...ordersRef.current]);
      }
      updateMetrics();
    }, 350);

    // Group queue indices into chunks of strictly 10 orders (theo chuẩn cổng tra cứu J&T Express)
    const CHUNK_SIZE = 10;
    const chunks: number[][] = [];
    for (let i = 0; i < queueIndices.length; i += CHUNK_SIZE) {
      chunks.push(queueIndices.slice(i, i + CHUNK_SIZE));
    }

    let chunkCursor = 0;
    // Worker count scales with concurrency: 10 => 1 cụm 10 đơn; 20 => 2 cụm song song; 30 => 3 cụm song song; etc.
    const workerCount = Math.min(Math.max(1, Math.floor(concurrency / 10)), chunks.length);

    const chunkWorker = async () => {
      while (chunkCursor < chunks.length && !isStoppingRef.current) {
        const currentChunk = chunks[chunkCursor++];
        if (!currentChunk || currentChunk.length === 0) break;

        // Mark items as checking in memory and immediately push to UI state
        // so user sees all 10 items in this batch flashing/checking together!
        const queryItems: { code: string; carrier?: CarrierId; cellphone?: string }[] = [];
        for (const idx of currentChunk) {
          const item = ordersRef.current[idx];
          if (item) {
            ordersRef.current[idx] = { 
              ...item, 
              isChecking: true,
              rawStatusText: item.rawStatusText === 'Chưa kiểm tra' ? 'Đang tra cứu (Cụm 10 đơn)...' : item.rawStatusText
            };
            queryItems.push({
              code: item.trackingCode,
              carrier: item.carrier,
              cellphone: item.extraInfo?.customerPhone || jtPhoneSuffix
            });
          }
        }
        setOrders([...ordersRef.current]);

        try {
          // ALWAYS force live carrier query when user triggers scan/check
          const batchResults = await trackBatchOrders(queryItems, true);

          for (const idx of currentChunk) {
            const item = ordersRef.current[idx];
            if (!item) continue;

            const codeKey = item.trackingCode;
            const res = batchResults[codeKey] 
              || (codeKey ? batchResults[codeKey.trim()] : undefined)
              || (codeKey ? batchResults[codeKey.trim().toUpperCase()] : undefined);

            const oldHasScan = Boolean(
              item.scannedAt || 
              item.statusCategory === 'scanned' || 
              item.statusCategory === 'in_transit' || 
              item.statusCategory === 'delivered' ||
              (item.statusDetail && (
                item.statusDetail.includes('đã lấy hàng') || 
                item.statusDetail.includes('quét mã thành công') ||
                item.statusDetail.includes('ký nhận') ||
                item.statusDetail.includes('giao thành công')
              ))
            );

            if (res) {
              // NẾU đơn đã có thông tin scan thành công trước đó mà lần gọi mới bị lỗi mạng/timeout:
              // TUYỆT ĐỐI KHÔNG ĐÈ TRẠNG THÁI LỖI LÊN ĐƠN ĐÃ SCAN!
              if (res.statusCategory === 'error' && oldHasScan) {
                ordersRef.current[idx] = {
                  ...item,
                  isChecking: false
                };
              } else {
                ordersRef.current[idx] = {
                  ...item,
                  carrier: res.carrier || item.carrier,
                  statusCategory: res.statusCategory,
                  rawStatusText: res.rawStatusText,
                  statusDetail: res.statusDetail,
                  scannedAt: res.scannedAt || (oldHasScan ? item.scannedAt : undefined),
                  updatedAt: res.updatedAt || item.updatedAt,
                  timeline: (res.timeline && res.timeline.length > 0) ? res.timeline : item.timeline,
                  error: res.error,
                  isChecking: false
                };
              }
            } else {
              // Khi hệ thống không nhận được kết quả (timeout/bận)
              ordersRef.current[idx] = {
                ...item,
                isChecking: false,
                ...(oldHasScan ? {} : {
                  statusCategory: 'not_scanned',
                  rawStatusText: 'Chưa scan (Chờ quét lại)',
                  error: undefined
                })
              };
            }
          }
        } catch (err: any) {
          for (const idx of currentChunk) {
            const item = ordersRef.current[idx];
            if (item) {
              const oldHasScan = Boolean(
                item.scannedAt || 
                item.statusCategory === 'scanned' || 
                item.statusCategory === 'in_transit' || 
                item.statusCategory === 'delivered' ||
                (item.statusDetail && (
                  item.statusDetail.includes('đã lấy hàng') || 
                  item.statusDetail.includes('quét mã thành công') ||
                  item.statusDetail.includes('ký nhận') ||
                  item.statusDetail.includes('giao thành công')
                ))
              );
              ordersRef.current[idx] = {
                ...item,
                isChecking: false,
                ...(oldHasScan ? {} : {
                  statusCategory: 'not_scanned',
                  rawStatusText: 'Chưa scan (Chờ quét lại)',
                  error: undefined
                })
              };
            }
          }
        } finally {
          completedCount += currentChunk.length;
          setOrders([...ordersRef.current]);
          // Instant batch UPSERT to SQLite database in real-time
          const updatedChunkItems = currentChunk.map(idx => ordersRef.current[idx]).filter(Boolean);
          upsertOrdersToSql(updatedChunkItems);
          updateMetrics();
        }
      }
    };

    // Run parallel chunk workers
    const workers = Array.from({ length: workerCount }, () => chunkWorker());
    await Promise.all(workers);

    clearInterval(flushInterval);

    // Final flush: ensure all isChecking flags are cleared to false
    ordersRef.current = ordersRef.current.map(o => o.isChecking ? { ...o, isChecking: false } : o);
    setOrders([...ordersRef.current]);
    saveOrdersToStorage(ordersRef.current);
    setIsProcessing(false);
    isRunningRef.current = false;
    updateMetrics();

    if (!isStoppingRef.current) {
      showToast(`Hoàn tất kiểm tra trạng thái ${queueIndices.length.toLocaleString()} vận đơn!`);
    }
  };

  const handleStartTracking = (scope: 'all' | '3days' | '7days' | '14days' | 'unscanned' = 'all') => {
    clearTrackingCache();
    startBatchExecution(orders, scope);
  };

  const handlePauseTracking = () => {
    isStoppingRef.current = true;
    setIsProcessing(false);
    ordersRef.current = ordersRef.current.map(o => o.isChecking ? { ...o, isChecking: false } : o);
    setOrders([...ordersRef.current]);
    showToast('Đã tạm dừng tiến trình quét.');
  };

  const handleReloadFromDatabase = async () => {
    setIsLoadingFromDb(true);
    try {
      const persisted = await loadPersistedOrders();
      if (persisted.length > 0) {
        ordersRef.current = persisted;
        setOrders(persisted);
        showToast(`🟢 Đã đồng bộ thành công ${persisted.length.toLocaleString()} đơn từ Cloud SQL!`);
      } else {
        showToast('Chưa có dữ liệu trong Database.');
      }
    } catch (err: any) {
      showToast('Lỗi khi tải từ Database: ' + err.message);
    } finally {
      setIsLoadingFromDb(false);
    }
  };

  const handleRetryUnscanned = () => {
    clearTrackingCache();
    startBatchExecution(orders, 'unscanned');
  };

  // Fast Two-Tier Data Loading (Stale-While-Revalidate: 0.05s Instant IndexedDB + Cloud SQL Sync)
  useEffect(() => {
    let isMounted = true;

    // Tier 1: Instant local read from browser IndexedDB (Loads 18,000+ orders in 50ms, zero lag!)
    loadIndexedDBOrders().then(cachedOrders => {
      if (isMounted && cachedOrders.length > 0) {
        setOrders(prev => {
          if (prev.length === 0) {
            ordersRef.current = cachedOrders;
            return cachedOrders;
          }
          return prev;
        });
        setIsLoadingFromDb(false);
      }
    });

    // Show loading indicator only if screen currently has no orders at all
    if (orders.length === 0) {
      setIsLoadingFromDb(true);
    }

    // Tier 2: Background network fetch from Cloud SQL (served in 1-5ms via server RAM Cache)
    loadPersistedOrders().then(persisted => {
      if (isMounted && persisted.length > 0) {
        setOrders(prev => {
          if (prev.length === 0 || persisted.length >= prev.length) {
            ordersRef.current = persisted;
            return persisted;
          }
          return prev;
        });

        const scannedCount = persisted.filter(
          o => o.statusCategory !== 'not_scanned' && o.rawStatusText !== 'Chưa kiểm tra' && o.rawStatusText !== 'Chờ kiểm tra Live API'
        ).length;
        const unscannedCount = persisted.filter(
          o => o.statusCategory === 'not_scanned' || o.rawStatusText === 'Chưa kiểm tra' || o.rawStatusText === 'Chờ kiểm tra Live API'
        ).length;

        showToast(`🟢 Đã đồng bộ ${persisted.length.toLocaleString()} đơn từ Cloud SQL (${scannedCount.toLocaleString()} đã scan, ${unscannedCount.toLocaleString()} chờ cập nhật).`);
      }
    }).catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingFromDb(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Handler for restoring or importing full orders from a JSON backup file
  const handleImportFullOrders = (importedOrders: any[]) => {
    isStoppingRef.current = true;
    setIsProcessing(false);
    const normalized = normalizeOrderList(importedOrders);
    setOrders(normalized);
    ordersRef.current = normalized;
    saveOrdersToStorage(normalized);

    const scannedCount = normalized.filter(
      o => o.statusCategory !== 'not_scanned' && o.rawStatusText !== 'Chưa kiểm tra' && o.rawStatusText !== 'Chờ kiểm tra Live API'
    ).length;
    const unscannedCount = normalized.filter(
      o => o.statusCategory === 'not_scanned' || o.rawStatusText === 'Chưa kiểm tra' || o.rawStatusText === 'Chờ kiểm tra Live API'
    ).length;

    showToast(`Đã nạp ${normalized.length.toLocaleString()} đơn từ file JSON (${scannedCount} đã scan, ${unscannedCount} chưa scan)!`);

    if (unscannedCount > 0) {
      setTimeout(() => {
        startBatchExecution(normalized, 'unscanned');
      }, 400);
    }
  };

  const handleRefreshSingleOrder = async (order: OrderItem, customPhone?: string) => {
    try {
      const phoneToUse = customPhone || order.extraInfo?.customerPhone || jtPhoneSuffix;
      const res = await trackSingleOrder(
        order.trackingCode,
        order.carrier,
        phoneToUse,
        true, // force refresh from live API
        jtPhoneSuffix
      );
      const updatedOrder: OrderItem = {
        ...order,
        carrier: res.carrier,
        statusCategory: res.statusCategory,
        rawStatusText: res.rawStatusText,
        statusDetail: res.statusDetail,
        scannedAt: res.scannedAt,
        updatedAt: res.updatedAt,
        timeline: res.timeline,
        error: res.error,
        isChecking: false,
        extraInfo: {
          ...order.extraInfo,
          customerPhone: phoneToUse
        }
      };
      ordersRef.current = ordersRef.current.map(o => (o.id === order.id || o.trackingCode === order.trackingCode) ? updatedOrder : o);
      setOrders([...ordersRef.current]);
      setSelectedOrder(updatedOrder);
      // Persist immediately to SQLite database
      upsertOrdersToSql([updatedOrder]);
      showToast(`Đã đồng bộ trạng thái trực tiếp: ${res.rawStatusText}`);
    } catch (e: any) {
      showToast(`Lỗi khi làm mới: ${e.message}`);
    }
  };

  const handleSelectOrder = (order: OrderItem) => {
    setSelectedOrder(order);
    // Automatically trigger fresh live check in background for supported carriers
    if (order.carrier === 'ghn' || order.carrier === 'jt' || order.carrier === 'spx' || order.carrier === 'vnpost' || order.carrier === 'best') {
      handleRefreshSingleOrder(order);
    }
  };

  const handleYunWMSSyncComplete = (syncedOrders: OrderItem[], autoTrack: boolean, appendMode: boolean) => {
    let finalOrders: OrderItem[];
    const currentList = ordersRef.current.length > 0 ? ordersRef.current : orders;

    // Smart merge by trackingCode: keep existing scanned/checked status, update/append from WMS
    const existingMap = new Map<string, OrderItem>(currentList.map(o => [o.trackingCode, o]));
    
    for (const item of syncedOrders) {
      const existing = existingMap.get(item.trackingCode);
      if (existing) {
        // If already scanned or checked by carrier live API, preserve live carrier status
        const isAlreadyChecked = existing.statusCategory !== 'not_scanned' || Boolean(existing.scannedAt);
        existingMap.set(item.trackingCode, {
          ...item,
          ...existing,
          orderNo: item.orderNo || existing.orderNo,
          warehouseId: item.warehouseId || existing.warehouseId,
          warehouseName: item.warehouseName || existing.warehouseName,
          carrierChannel: item.carrierChannel || existing.carrierChannel,
          wmsStatus: item.wmsStatus || existing.wmsStatus,
          extraInfo: {
            ...(existing.extraInfo || {}),
            ...(item.extraInfo || {})
          },
          ...(isAlreadyChecked ? {
            statusCategory: existing.statusCategory,
            rawStatusText: existing.rawStatusText,
            statusDetail: existing.statusDetail,
            scannedAt: existing.scannedAt,
            timeline: existing.timeline
          } : {
            ...(existing.rawStatusText && !existing.rawStatusText.includes('Chưa kiểm tra') ? {
              rawStatusText: existing.rawStatusText,
              statusDetail: existing.statusDetail,
              timeline: existing.timeline
            } : {})
          })
        });
      } else {
        existingMap.set(item.trackingCode, item);
      }
    }

    if (appendMode || currentList.length > 0) {
      finalOrders = Array.from(existingMap.values());
      const newCount = finalOrders.length - currentList.length;
      showToast(`Đã đồng bộ ${syncedOrders.length.toLocaleString()} đơn từ YunWMS (Thêm ${newCount > 0 ? newCount.toLocaleString() : 0} mới, cập nhật ${syncedOrders.length.toLocaleString()} đơn). Tổng: ${finalOrders.length.toLocaleString()} đơn.`);
    } else {
      finalOrders = syncedOrders;
      showToast(`Đã đồng bộ ${finalOrders.length.toLocaleString()} đơn từ YunWMS vào hệ thống.`);
    }

    setOrders(finalOrders);
    ordersRef.current = finalOrders;

    // Immediately persist ONLY the synced orders to SQLite (fast & lightweight)
    upsertOrdersToSql(syncedOrders);

    if (autoTrack && finalOrders.length > 0) {
      setTimeout(() => {
        startBatchExecution(finalOrders, 'unscanned');
      }, 200);
    }
  };

  // --- Auto Sync Periodic Poller & Auto Scan Engine ---
  const performAutoPullAndScan = async () => {
    if (isAutoSyncingRef.current) return;
    isAutoSyncingRef.current = true;
    setIsAutoSyncing(true);

    try {
      const latestOrders = await fetchLatestWMSOrders(100);
      if (!latestOrders || latestOrders.length === 0) {
        setLastAutoSyncTime(new Date());
        setLastAutoSyncAddedCount(0);
        return;
      }

      const currentList = ordersRef.current.length > 0 ? ordersRef.current : orders;
      const existingMap = new Map<string, OrderItem>(currentList.map(o => [o.trackingCode, o]));
      let addedCount = 0;

      for (const item of latestOrders) {
        const existing = existingMap.get(item.trackingCode);
        if (existing) {
          // If already checked by carrier live tracking, preserve live carrier status
          const isAlreadyChecked = existing.statusCategory !== 'not_scanned' || Boolean(existing.scannedAt);
          existingMap.set(item.trackingCode, {
            ...item,
            ...existing,
            orderNo: item.orderNo || existing.orderNo,
            warehouseId: item.warehouseId || existing.warehouseId,
            warehouseName: item.warehouseName || existing.warehouseName,
            carrierChannel: item.carrierChannel || existing.carrierChannel,
            wmsStatus: item.wmsStatus || existing.wmsStatus,
            extraInfo: {
              ...(existing.extraInfo || {}),
              ...(item.extraInfo || {})
            },
            ...(isAlreadyChecked ? {
              statusCategory: existing.statusCategory,
              rawStatusText: existing.rawStatusText,
              statusDetail: existing.statusDetail,
              scannedAt: existing.scannedAt,
              timeline: existing.timeline
            } : {
              ...(existing.rawStatusText && !existing.rawStatusText.includes('Chưa kiểm tra') ? {
                rawStatusText: existing.rawStatusText,
                statusDetail: existing.statusDetail,
                timeline: existing.timeline
              } : {})
            })
          });
        } else {
          existingMap.set(item.trackingCode, item);
          addedCount++;
        }
      }

      const mergedList = Array.from(existingMap.values());
      setOrders(mergedList);
      ordersRef.current = mergedList;

      // Upsert ONLY the newly fetched orders to SQLite database (lightweight, non-blocking)
      upsertOrdersToSql(latestOrders);
      setLastAutoSyncTime(new Date());
      setLastAutoSyncAddedCount(addedCount);

      if (addedCount > 0) {
        showToast(`⚡ Tự động kéo WMS: +${addedCount} mã vận đơn Shipper mới! Đang kích hoạt quét live...`);
      }

      // Check if there are unscanned orders and start batch execution if not already scanning
      const hasUnscanned = mergedList.some(o => o.statusCategory === 'not_scanned');
      if (hasUnscanned && !isRunningRef.current) {
        setTimeout(() => {
          startBatchExecution(mergedList, 'unscanned');
        }, 200);
      }
    } catch (err: any) {
      console.warn('Auto sync warning:', err);
    } finally {
      setIsAutoSyncing(false);
      isAutoSyncingRef.current = false;
    }
  };

  const handleToggleAutoSync = (enabled: boolean) => {
    setIsAutoSyncEnabled(enabled);
    setAutoSyncCountdown(autoSyncInterval);
    try {
      localStorage.setItem('auto_sync_enabled', String(enabled));
    } catch {}
    if (enabled) {
      showToast(`Đã BẬT tự động cập nhật WMS mỗi ${autoSyncInterval}s`);
    } else {
      showToast('Đã TẮT tự động cập nhật WMS');
    }
  };

  const handleChangeAutoSyncInterval = (seconds: number) => {
    setAutoSyncInterval(seconds);
    setAutoSyncCountdown(seconds);
    try {
      localStorage.setItem('auto_sync_interval', String(seconds));
    } catch {}
    const label = seconds >= 60 ? `${seconds / 60} phút` : `${seconds}s`;
    showToast(`Đã đổi chu kỳ tự động cập nhật thành ${label}`);
  };

  // 1-second countdown ticker for Auto Sync
  useEffect(() => {
    if (!isAutoSyncEnabled) {
      setAutoSyncCountdown(autoSyncInterval);
      return;
    }

    const timer = setInterval(() => {
      setAutoSyncCountdown((prev) => {
        if (prev <= 1) {
          performAutoPullAndScan();
          return autoSyncInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isAutoSyncEnabled, autoSyncInterval]);

  const handleRecheckAll = () => {
    clearTrackingCache();
    startBatchExecution(orders, 'all');
  };

  const handleReset = () => {
    isStoppingRef.current = true;
    setIsProcessing(false);
    clearTrackingCache();
    setOrders([]);
    setSelectedOrder(null);
    setSelectedStatus('all');
    setSelectedCarrier('all');
    setSearchTerm('');
    setTrackingMetrics(null);
    clearPersistedOrders();
    showToast('Đã xóa sạch dữ liệu. Bạn có thể dán danh sách mới ở trên!');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-slate-900 selection:text-white antialiased">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xl border border-slate-800 flex items-center space-x-2.5">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Global Header */}
      <Header
        totalCount={orders.length}
        onReset={handleReset}
        onOpenGuide={() => setShowGuide(true)}
        onOpenYunWMS={() => setShowYunWMSModal(true)}
        onOpenJNT10Modal={() => setShowJNT10Modal(true)}
        onReloadDatabase={handleReloadFromDatabase}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Cloud SQL Loading Indicator */}
        {isLoadingFromDb && (
          <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 shadow-xs animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs sm:text-sm font-bold">
                Đang truy xuất dữ liệu tức thì từ Cloud SQL (Turso)...
              </span>
            </div>
            <span className="text-xs font-mono font-semibold text-indigo-600">
              {orders.length > 0 ? `${orders.length.toLocaleString()} đơn` : 'Đang kết nối...'}
            </span>
          </div>
        )}

        {/* Step 1: Input / Import Area */}
        <ImportArea
          onImport={handleImport}
          onAppendImport={handleAppendImport}
          onImportFullOrders={handleImportFullOrders}
          onClearAll={handleReset}
          onOpenYunWMS={() => setShowYunWMSModal(true)}
          onOpenJNT10Modal={() => setShowJNT10Modal(true)}
          currentCount={orders.length}
          isProcessing={isProcessing}
          jtPhoneSuffix={jtPhoneSuffix}
          onJtPhoneSuffixChange={handleJtPhoneSuffixChange}
        />

        {/* Step 1.5: Real-time Auto-Sync & Periodic Scanner Bar */}
        <AutoSyncBar
          isEnabled={isAutoSyncEnabled}
          onToggle={handleToggleAutoSync}
          intervalSeconds={autoSyncInterval}
          onChangeInterval={handleChangeAutoSyncInterval}
          countdown={autoSyncCountdown}
          isSyncing={isAutoSyncing}
          lastSyncTime={lastAutoSyncTime}
          lastAddedCount={lastAutoSyncAddedCount}
          onTriggerNow={() => {
            setAutoSyncCountdown(autoSyncInterval);
            performAutoPullAndScan();
          }}
          onOpenSettings={() => setShowYunWMSModal(true)}
        />

        {/* Step 2: Stats & Visual Progress Overview */}
        {orders.length > 0 && (
          <StatsOverview
            stats={stats}
            selectedFilter={selectedStatus}
            onSelectFilter={(status) => setSelectedStatus(status)}
            onRetryUnscanned={handleRetryUnscanned}
            isProcessing={isProcessing}
            activeWorkers={concurrency}
            metrics={trackingMetrics}
          />
        )}

        {/* Step 3: Batch Controls & Action Bar */}
        {orders.length > 0 && (
          <BatchControls
            orders={orders}
            filteredOrders={filteredOrders}
            isProcessing={isProcessing}
            onStartTracking={handleStartTracking}
            onPauseTracking={handlePauseTracking}
            onRetryUnscanned={handleRetryUnscanned}
            onRecheckAll={handleRecheckAll}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedCarrier={selectedCarrier}
            onCarrierChange={setSelectedCarrier}
            concurrency={concurrency}
            onConcurrencyChange={setConcurrency}
            onClearAll={handleReset}
            onToast={showToast}
            metrics={trackingMetrics}
            activeScope={activeScanScope}
          />
        )}

        {/* Step 4: High-Performance Data Table */}
        {orders.length > 0 && (
          <OrderTable
            orders={filteredOrders}
            onSelectOrder={handleSelectOrder}
            onToast={showToast}
            onRetryUnscanned={handleRetryUnscanned}
            onTrackSelected={(selectedOrders) => startBatchExecution(selectedOrders, 'all')}
            onOpenJNT10Modal={() => setShowJNT10Modal(true)}
            isProcessing={isProcessing}
            defaultJtPhone={jtPhoneSuffix}
          />
        )}

      </main>

      {/* Order Journey Details Modal */}
      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onToast={showToast}
        onRefresh={handleRefreshSingleOrder}
        defaultJtSuffix={jtPhoneSuffix}
        allOrders={orders}
      />

      {/* Carrier Detection Rules Modal */}
      <CarrierGuideModal
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />

      {/* YunWMS Real-time Sync Modal */}
      <YunWMSSyncModal
        isOpen={showYunWMSModal}
        onClose={() => setShowYunWMSModal(false)}
        onSyncComplete={handleYunWMSSyncComplete}
        onToast={showToast}
      />

      {/* J&T Express 10-Orders Multi-Tracking Modal */}
      <JNTMultiTrackModal
        isOpen={showJNT10Modal}
        onClose={() => setShowJNT10Modal(false)}
        onToast={showToast}
        onImportOrders={handleAppendImport}
        existingJtCodes={orders.filter(o => o.carrier === 'jt').map(o => o.trackingCode)}
        defaultPhone={jtPhoneSuffix}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-xs text-slate-500 mt-auto">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 font-medium">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Hệ thống tra cứu vận đơn số lượng lớn đa sàn • GHN, SPX, J&T Express, Viettel Post, Ninja Van</span>
          </div>
          <span className="text-slate-400 font-mono">Xử lý song song 5.000+ đơn/lần</span>
        </div>
      </footer>

    </div>
  );
}
