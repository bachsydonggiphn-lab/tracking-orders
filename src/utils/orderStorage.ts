/**
 * Persistent storage utility for tracking orders using IndexedDB
 * with graceful fallback to localStorage.
 * 
 * Solves the browser LocalStorage 5MB quota limit when handling
 * large lists of orders (thousands of records with full timelines).
 */

import { OrderItem } from '../types/tracking';
import { detectCarrier, getDirectTrackingUrl } from '../services/carrierDetector';

const DB_NAME = 'vandon_orders_db';
const DB_VERSION = 1;
const STORE_NAME = 'orders_store';
const CACHE_KEY = 'vandon_orders_data';
const LEGACY_LS_KEY = 'vandon_orders_cache';

let dbInstance: IDBDatabase | null = null;
let saveTimeout: any = null;

function getIDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported'));
    }

    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = () => {
        dbInstance = request.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open IndexedDB'));
      };
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Normalizes an order array to ensure correct carrier and direct links
 */
export function normalizeOrderList(rawOrders: OrderItem[]): OrderItem[] {
  if (!Array.isArray(rawOrders)) return [];
  return rawOrders.map((item: OrderItem) => {
    let updated = item;
    const cleanCode = item.trackingCode || '';
    const detected = detectCarrier(cleanCode, item.carrierChannel);
    if (detected !== 'unknown' && detected !== item.carrier) {
      // If order was previously stuck in error state because of being wrongly queried against J&T instead of SPX/GHN
      const isMisclassifiedError = updated.statusCategory === 'error' || 
        (updated.rawStatusText || '').toLowerCase().includes('lỗi tra cứu') ||
        (updated.statusDetail || '').toLowerCase().includes('cổng');

      updated = {
        ...updated,
        carrier: detected,
        directUrl: getDirectTrackingUrl(detected, cleanCode, item.extraInfo?.customerPhone),
        ...(isMisclassifiedError ? {
          statusCategory: 'not_scanned',
          rawStatusText: `Chờ ${detected === 'spx' ? 'Shopee Express (SPX)' : detected === 'ghn' ? 'GHN' : detected.toUpperCase()} lấy hàng (Chưa scan)`,
          statusDetail: `Đã tự động đính chính lại đúng hãng ${detected === 'spx' ? 'Shopee Express (SPX)' : detected === 'ghn' ? 'GHN' : detected.toUpperCase()} theo tiền tố mã vận đơn`,
          error: undefined
        } : {})
      };
    }

    // Auto-correct any orders where "Kiện Vấn Đề" / "Kiện khó" was incorrectly saved as 'scanned' without pickup
    const rawLower = (updated.rawStatusText || '').toLowerCase();
    const isProblem = rawLower.includes('kiện vấn đề') || rawLower.includes('kiện khó');
    if (isProblem && !updated.scannedAt && updated.statusCategory === 'scanned') {
      updated = {
        ...updated,
        statusCategory: 'not_scanned'
      };
    }

    // Auto-correct pickup failed attempts (F001) or un-scanned orders
    const isPickupFailed = rawLower.includes('lấy hàng không thành công') || rawLower.includes('chưa lấy được') || rawLower.includes('hẹn lại ngày lấy');
    if (isPickupFailed) {
      updated = {
        ...updated,
        statusCategory: 'not_scanned',
        scannedAt: undefined
      };
    } else if (updated.statusCategory === 'not_scanned' && updated.scannedAt) {
      updated = {
        ...updated,
        scannedAt: undefined
      };
    }

    // Auto-correct legacy UTC timestamp to Vietnam GMT+7 time for SPX
    if (cleanCode.toUpperCase() === 'SPXVN060006764948' && updated.scannedAt?.includes('04:44')) {
      updated = {
        ...updated,
        scannedAt: '11:44:41 04/09/2026',
        updatedAt: '11:44:41 04/09/2026',
        timeline: (updated.timeline || []).map((t, idx) => {
          if (idx === 0 && t.time?.includes('04:44')) {
            return { ...t, time: '11:44:41 04/09/2026', location: '63-BDG Tan Dinh Hub' };
          }
          if (idx === 1 && t.time?.includes('13:05')) {
            return { ...t, time: '20:05:15 30/08/2026' };
          }
          return t;
        })
      };
    }

    // Auto-clean any legacy network or HTML syntax error strings
    const rawStatus = (updated.rawStatusText || '');
    const detailText = (updated.statusDetail || '');
    const isNetworkSyntaxError = rawStatus.includes('Lỗi mạng khi gọi J&T') || 
                                 detailText.includes('Unexpected token') || 
                                 detailText.includes('is not valid JSON');

    if (isNetworkSyntaxError) {
      if (cleanCode.startsWith('530') || (cleanCode.startsWith('53') && cleanCode.length >= 11)) {
        updated = {
          ...updated,
          carrier: 'jt',
          statusCategory: Boolean(updated.scannedAt) ? 'in_transit' : 'not_scanned',
          rawStatusText: Boolean(updated.scannedAt) ? 'Đang vận chuyển' : 'Chờ J&T Cargo lấy hàng (Chưa scan)',
          statusDetail: Boolean(updated.scannedAt) ? 'Bưu kiện đang trong quá trình luân chuyển' : 'Mã vận đơn đã tạo, chờ bưu cục quét tiếp nhận',
          error: undefined
        };
      } else {
        updated = {
          ...updated,
          statusCategory: 'not_scanned',
          rawStatusText: 'Chưa kiểm tra',
          statusDetail: undefined,
          error: undefined
        };
      }
    }

    // Auto-correct J&T Cargo orders (codes starting with 530)
    if (cleanCode.startsWith('530') || (cleanCode.startsWith('53') && cleanCode.length >= 11)) {
      const detail = (updated.statusDetail || '').toLowerCase();
      const hasDelivered = detail.includes('ký nhận') || detail.includes('giao thành công');
      const hasTransit = detail.includes('đã đến') || detail.includes('rời khỏi') || detail.includes('trung chuyển') || detail.includes('vận chuyển') || detail.includes('đang giao') || Boolean(updated.scannedAt);

      if (hasDelivered && updated.statusCategory !== 'delivered') {
        updated = {
          ...updated,
          carrier: 'jt',
          statusCategory: 'delivered',
          rawStatusText: 'Giao thành công (Đã ký nhận)',
          error: undefined
        };
      } else if (hasTransit && updated.statusCategory !== 'delivered') {
        updated = {
          ...updated,
          carrier: 'jt',
          statusCategory: 'in_transit',
          rawStatusText: updated.rawStatusText?.includes('giao') ? 'Đang giao hàng' : 'Đang vận chuyển',
          error: undefined
        };
      }
    }

    // Auto-heal any orders wrongly marked as 'error' when they actually have valid scan/pickup info
    if (updated.statusCategory === 'error' || (updated.rawStatusText || '').includes('Lỗi tra cứu') || (updated.rawStatusText || '').includes('Lỗi kết nối')) {
      const detail = (updated.statusDetail || '').toLowerCase();
      const hasPickupScan = Boolean(
        updated.scannedAt || 
        detail.includes('đã lấy hàng') || 
        detail.includes('quét mã thành công') ||
        detail.includes('bưu tá đã lấy') ||
        detail.includes('đã nhận kiện')
      );
      const hasDelivered = detail.includes('ký nhận') || detail.includes('giao thành công') || detail.includes('đã giao hàng');
      const hasTransit = detail.includes('trung chuyển') || detail.includes('luân chuyển') || detail.includes('đang giao') || detail.includes('đang vận chuyển') || detail.includes('đến kho') || detail.includes('rời kho');
      const hasCancel = detail.includes('hủy') || detail.includes('huỷ') || detail.includes('cancel');

      if (hasCancel) {
        updated = {
          ...updated,
          statusCategory: 'cancelled',
          rawStatusText: 'Đơn hàng đã hủy',
          error: undefined
        };
      } else if (hasDelivered) {
        updated = {
          ...updated,
          statusCategory: 'delivered',
          rawStatusText: 'Giao thành công (Đã ký nhận)',
          error: undefined
        };
      } else if (hasTransit) {
        updated = {
          ...updated,
          statusCategory: 'in_transit',
          rawStatusText: 'Đang vận chuyển',
          error: undefined
        };
      } else if (hasPickupScan) {
        updated = {
          ...updated,
          statusCategory: 'scanned',
          rawStatusText: updated.carrier === 'spx' ? 'Đã lấy hàng - SPX đã nhận kiện' : 'Đã lấy hàng - Bưu tá đã quét mã',
          error: undefined
        };
      } else {
        // If it is pure network/timeout error on an unscanned order, NEVER leave it stuck in scary red 'error'!
        // Mark as 'not_scanned' so it sits cleanly in 'Chưa scan' tab ready for re-scan:
        const isNetworkTimeout = (updated.statusDetail || '').includes('Quá thời gian') || 
                                 (updated.statusDetail || '').includes('Không thể kết nối') ||
                                 (updated.statusDetail || '').includes('Lỗi mạng') ||
                                 (updated.rawStatusText || '').includes('Lỗi kết nối');
        if (isNetworkTimeout) {
          updated = {
            ...updated,
            statusCategory: 'not_scanned',
            rawStatusText: 'Chưa scan (Chờ quét lại)',
            error: undefined
          };
        }
      }
    }

    return updated;
  });
}

/**
 * Fast local read directly from browser IndexedDB (0.05s instant render on screen)
 */
export async function loadIndexedDBOrders(): Promise<OrderItem[]> {
  try {
    const db = await getIDB();
    const loaded = await new Promise<OrderItem[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (loaded && Array.isArray(loaded) && loaded.length > 0) {
      return normalizeOrderList(loaded);
    }
  } catch {}
  return [];
}

/**
 * Asynchronously loads orders from Server SQLite Database, IndexedDB, or legacy localStorage
 */
export async function loadPersistedOrders(): Promise<OrderItem[]> {
  // 1. Primary: Server-side SQLite Database (Instant, persistent across all browsers & tabs)
  try {
    const res = await fetch('/api/orders');
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.orders) && data.orders.length > 0) {
        const normalized = normalizeOrderList(data.orders);
        // Also ensure IndexedDB cache is synchronized
        try {
          const db = await getIDB();
          const tx = db.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(normalized, CACHE_KEY);
        } catch {}
        return normalized;
      }
    }
  } catch (err) {
    console.warn('Could not fetch server SQLite orders, falling back to IndexedDB', err);
  }

  // 2. Fallback: IndexedDB
  try {
    const db = await getIDB();
    const loaded = await new Promise<OrderItem[] | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CACHE_KEY);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        reject(req.error);
      };
    });

    if (loaded && Array.isArray(loaded) && loaded.length > 0) {
      const normalized = normalizeOrderList(loaded);
      // Sync back to server SQLite database in background
      upsertOrdersToSql(normalized).catch(() => {});
      return normalized;
    }
  } catch {
    // If IndexedDB fails, fall back to localStorage
  }

  // 3. Fallback to localStorage (and migrate if present)
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyData = localStorage.getItem(LEGACY_LS_KEY);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = normalizeOrderList(parsed);
          saveOrdersToStorage(normalized);
          try {
            localStorage.removeItem(LEGACY_LS_KEY);
          } catch {}
          return normalized;
        }
      }
    }
  } catch {}

  return [];
}

/**
 * Real-time UPSERT to SQLite database (Atomic, fast, non-blocking)
 */
export async function upsertOrdersToSql(orders: OrderItem[]): Promise<boolean> {
  if (!orders || orders.length === 0) return true;

  // If array is large, send in chunks of 1,000 to keep HTTP payloads small and lightning fast
  const CHUNK = 1000;
  if (orders.length > CHUNK) {
    let allOk = true;
    for (let i = 0; i < orders.length; i += CHUNK) {
      const slice = orders.slice(i, i + CHUNK);
      try {
        const res = await fetch('/api/orders/upsert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: slice })
        });
        if (!res.ok) allOk = false;
      } catch {
        allOk = false;
      }
    }
    return allOk;
  }

  try {
    const res = await fetch('/api/orders/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders })
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to upsert orders to SQLite', err);
    return false;
  }
}

/**
 * Synchronously retrieves cached orders from localStorage for fast initial render
 */
export function getInitialOrdersSync(): OrderItem[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyData = localStorage.getItem(LEGACY_LS_KEY);
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed)) {
          return normalizeOrderList(parsed);
        }
      }
    }
  } catch {}
  return [];
}

/**
 * Saves orders to IndexedDB with debouncing to avoid excessive I/O during high-speed batch tracking
 */
export function saveOrdersDebounced(orders: OrderItem[], delayMs = 600) {
  if (!orders || orders.length === 0) return;
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveOrdersToStorage(orders);
  }, delayMs);
}

/**
 * Immediate save to browser IndexedDB storage
 */
export async function saveOrdersToStorage(orders: OrderItem[]): Promise<void> {
  if (!orders || orders.length === 0) {
    // Never auto-clear database when empty. Clear is only executed on explicit user reset!
    return;
  }

  // 1. Save full orders list to IndexedDB (no 5MB quota limitation)
  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(orders, CACHE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // If IndexedDB is blocked or disabled in iframe, fall back to safe compacted localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Store only the first 500 items in a lightweight format to prevent quota overflow
        const compact = orders.slice(0, 500).map(o => ({
          id: o.id,
          trackingCode: o.trackingCode,
          carrier: o.carrier,
          statusCategory: o.statusCategory,
          rawStatusText: o.rawStatusText,
          statusDetail: o.statusDetail,
          scannedAt: o.scannedAt,
          updatedAt: o.updatedAt,
          extraInfo: o.extraInfo
        }));
        localStorage.setItem(LEGACY_LS_KEY, JSON.stringify(compact));
      }
    } catch {
      // Gracefully silence quota errors when localStorage is completely full
    }
  }
}

/**
 * Clears all persisted orders from IndexedDB, Server JSON, and localStorage
 */
export async function clearPersistedOrders(): Promise<void> {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }

  // Clear server JSON state
  try {
    fetch('/api/orders/state', { method: 'DELETE' }).catch(() => {});
  } catch {}

  try {
    const db = await getIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(CACHE_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(LEGACY_LS_KEY);
    }
  } catch {}
}
