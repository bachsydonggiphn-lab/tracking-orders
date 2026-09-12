import { OrderItem } from '../types/tracking';

export type OrderAgeCategory = '1day' | '2days' | '3plus_days';

export interface OrderAgeInfo {
  days: number;
  category: OrderAgeCategory;
  label: string;
  badgeClass: string;
  dotColor: string;
  description: string;
}

/**
 * Parses various date formats found in YunWMS, SPX, J&T, GHN or Excel:
 * e.g. "26-09-07 23:52" (YunWMS YY-MM-DD), "10:59:46 08/09/2026", "2026-09-07 23:52:00", "07/09/2026", etc.
 */
export function parseOrderDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Format 1: Time first (e.g. "10:59:46 08/09/2026" or "10:59 08/09/2026")
  const timeFirstMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (timeFirstMatch) {
    const hour = parseInt(timeFirstMatch[1], 10);
    const min = parseInt(timeFirstMatch[2], 10);
    const sec = timeFirstMatch[3] ? parseInt(timeFirstMatch[3], 10) : 0;
    const day = parseInt(timeFirstMatch[4], 10);
    const month = parseInt(timeFirstMatch[5], 10) - 1;
    let year = parseInt(timeFirstMatch[6], 10);
    if (year < 100) year = 2000 + year;
    return new Date(year, month, day, hour, min, sec);
  }

  // Format 2: Standard ISO with 4-digit year: "2026-09-07" or "2026-09-07 23:52:00"
  const ymd4Match = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ymd4Match) {
    const year = parseInt(ymd4Match[1], 10);
    const month = parseInt(ymd4Match[2], 10) - 1;
    const day = parseInt(ymd4Match[3], 10);
    const hour = ymd4Match[4] ? parseInt(ymd4Match[4], 10) : 0;
    const min = ymd4Match[5] ? parseInt(ymd4Match[5], 10) : 0;
    const sec = ymd4Match[6] ? parseInt(ymd4Match[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec);
  }

  // Format 3: YunWMS / Chinese WMS format: YY-MM-DD (e.g. "26-09-07 23:52" where 26 is year 2026)
  // When the first token is in 20..39, it is unequivocally the 2-digit year in current era
  const ymd2Match = trimmed.match(/^([2-3]\d)[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ymd2Match) {
    const year = 2000 + parseInt(ymd2Match[1], 10);
    const month = parseInt(ymd2Match[2], 10) - 1;
    const day = parseInt(ymd2Match[3], 10);
    const hour = ymd2Match[4] ? parseInt(ymd2Match[4], 10) : 0;
    const min = ymd2Match[5] ? parseInt(ymd2Match[5], 10) : 0;
    const sec = ymd2Match[6] ? parseInt(ymd2Match[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec);
  }

  // Format 4: Vietnamese standard DD/MM/YYYY or DD-MM-YYYY (4-digit year at end)
  const dmy4Match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmy4Match) {
    const day = parseInt(dmy4Match[1], 10);
    const month = parseInt(dmy4Match[2], 10) - 1;
    const year = parseInt(dmy4Match[3], 10);
    const hour = dmy4Match[4] ? parseInt(dmy4Match[4], 10) : 0;
    const min = dmy4Match[5] ? parseInt(dmy4Match[5], 10) : 0;
    const sec = dmy4Match[6] ? parseInt(dmy4Match[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec);
  }

  // Format 5: DD/MM/YY (2-digit year at end, e.g. "07/09/26")
  const dmy2Match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2})(?:[T\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmy2Match) {
    const day = parseInt(dmy2Match[1], 10);
    const month = parseInt(dmy2Match[2], 10) - 1;
    const year = 2000 + parseInt(dmy2Match[3], 10);
    const hour = dmy2Match[4] ? parseInt(dmy2Match[4], 10) : 0;
    const min = dmy2Match[5] ? parseInt(dmy2Match[5], 10) : 0;
    const sec = dmy2Match[6] ? parseInt(dmy2Match[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec);
  }

  const standard = new Date(trimmed);
  if (!isNaN(standard.getTime())) {
    return standard;
  }

  return null;
}

/**
 * Extracts the best candidate date string from an OrderItem, with fallback
 * to extracting date from orderNo (e.g. YD-260907-3792 -> 26-09-07)
 */
export function resolveOrderDateString(order: OrderItem): string | undefined {
  if (order.extraInfo?.orderDate) return order.extraInfo.orderDate;
  if (order.scannedAt) return order.scannedAt;
  if (order.updatedAt) return order.updatedAt;

  // Fallback: extract date from orderNo or refNo (e.g. "YD-260907-3792" or "260907ECMQ...")
  const codeToInspect = order.orderNo || order.refNo || order.id || '';
  const m = codeToInspect.match(/(?:YD-)?(2[4-9])([0-1][0-9])([0-3][0-9])/i);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }
  return undefined;
}

/**
 * Calculates order age in days and groups into:
 * - 1day: 1 ngày tuổi (Đơn mới tạo trong 24h, đang chờ đóng hàng / chờ scan)
 * - 2days: 2 ngày tuổi (Đơn tạo từ hôm qua/24-48h, cần ưu tiên đóng & scan)
 * - 3plus_days: ≥ 3 ngày tuổi (Đơn tồn đọng từ 3 ngày trở lên, cần rà soát đóng gói & giục bưu cục lấy)
 */
export function getOrderAgeInfo(order: OrderItem, referenceDate: Date = new Date()): OrderAgeInfo {
  const dateStr = resolveOrderDateString(order);
  
  if (!dateStr) {
    return {
      days: 1,
      category: '1day',
      label: '1 ngày tuổi',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      dotColor: 'bg-emerald-500',
      description: 'Đơn mới tạo (Đang chờ đóng hàng để scan)'
    };
  }

  const parsed = parseOrderDate(dateStr);
  if (!parsed) {
    return {
      days: 1,
      category: '1day',
      label: '1 ngày tuổi',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold',
      dotColor: 'bg-emerald-500',
      description: 'Đơn mới tạo (Đang chờ đóng hàng để scan)'
    };
  }

  const diffMs = referenceDate.getTime() - parsed.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays <= 1) {
    return {
      days: 1,
      category: '1day',
      label: '1 ngày tuổi',
      badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 font-bold',
      dotColor: 'bg-emerald-500',
      description: 'Mới tạo trong 24h (Đang đóng hàng / chờ bưu tá scan)'
    };
  } else if (diffDays === 2) {
    return {
      days: 2,
      category: '2days',
      label: '2 ngày tuổi',
      badgeClass: 'bg-amber-100 text-amber-950 border-amber-400 font-bold',
      dotColor: 'bg-amber-500',
      description: 'Tạo 24h - 48h trước (Ưu tiên đóng gói & giục lấy hàng)'
    };
  } else {
    const ageDays = Math.max(3, diffDays);
    return {
      days: ageDays,
      category: '3plus_days',
      label: `≥ 3 ngày (${ageDays} ngày)`,
      badgeClass: 'bg-rose-100 text-rose-950 border-rose-400 font-bold',
      dotColor: 'bg-rose-600',
      description: `Tồn đọng ${ageDays} ngày (Chậm đóng hàng / Cần bưu tá lấy gấp)`
    };
  }
}

/**
 * Checks whether an order was created / updated within the last N days.
 * If no date metadata exists, defaults to true (so all orders without dates are included safely).
 */
export function isOrderWithinDays(order: OrderItem, days: number, referenceDate: Date = new Date()): boolean {
  const dateStr = resolveOrderDateString(order);
  if (!dateStr) {
    // If order has no explicit date, include it so we don't accidentally drop it
    return true;
  }

  const parsed = parseOrderDate(dateStr);
  if (!parsed) return true;

  const diffMs = referenceDate.getTime() - parsed.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Allow up to `days` days ago (and allow slight future time offsets up to 1 day due to timezone diffs)
  return diffDays >= -1 && diffDays <= days;
}

