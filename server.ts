import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import zlib from "zlib";
import { createServer as createViteServer } from "vite";
import { getAllSqliteOrders, getOrderTimeline, upsertSqliteOrders, clearSqliteOrders, getSqliteStats, getSqliteDb, initSqliteDb } from "./sqliteDb";
import { matchesTrackingPrefixFilter } from "./src/services/carrierDetector";

interface GHNTrackingLog {
  order_code: string;
  action_code?: string;
  status: string;
  status_name: string;
  location?: {
    address?: string;
  };
  executor?: {
    name?: string;
    phone?: string;
  };
  action_at: string;
}

interface GHNResponse {
  code: number;
  code_message?: string;
  message: string;
  data?: {
    order_info?: {
      order_code: string;
      status: string;
      status_name: string;
      picktime?: string;
      to_name?: string;
      to_phone?: string;
      to_address?: string;
      from_name?: string;
      from_phone?: string;
      from_address?: string;
      leadtime?: string;
      leadtime_order?: {
        from_estimate_date?: string;
        to_estimate_date?: string;
      };
      action?: string;
    };
    tracking_logs?: GHNTrackingLog[];
  };
}

function mapGHNStatus(ghnStatus: string, rawStatusName: string) {
  const s = (ghnStatus || '').toLowerCase().trim();
  const name = (rawStatusName || '').toLowerCase().trim();

  // 1. Returned / Hoàn hàng
  if (
    s === 'returned' ||
    s === 'return' ||
    s === 'waiting_to_return' ||
    s === 'returning' ||
    s === 'return_transporting' ||
    s === 'return_sorting' ||
    s === 'return_storing' ||
    s === 'return_fail' ||
    name.includes('hoàn hàng') ||
    name.includes('chuyển hoàn') ||
    name.includes('trả hàng') ||
    name.includes('đang hoàn') ||
    name.includes('hoàn trả')
  ) {
    return {
      category: 'returned',
      label: rawStatusName || 'Hoàn hàng / Chuyển hoàn',
      isScanned: true
    };
  }

  // 2. Delivered / Giao thành công
  if (
    s === 'delivered' || 
    name.includes('giao hàng thành công') || 
    name.includes('giao thành công') || 
    name.includes('đã giao') ||
    name.includes('phát thành công') ||
    name.includes('ký nhận')
  ) {
    return {
      category: 'delivered',
      label: rawStatusName || 'Giao hàng thành công',
      isScanned: true
    };
  }

  // 3. Cancelled / Đã hủy
  if (
    s === 'cancel' || 
    s === 'cancelled' || 
    name.includes('hủy') || 
    name.includes('huỷ') ||
    name.includes('từ chối nhận lúc lấy') ||
    name.includes('shop huỷ')
  ) {
    return {
      category: 'cancelled',
      label: rawStatusName || 'Đơn hàng đã hủy',
      isScanned: false
    };
  }

  // 4. Ready to pick / Chưa lấy hàng
  if (
    s === 'ready_to_pick' || 
    s === 'picking' ||
    name.includes('chờ lấy hàng') || 
    name.includes('chưa lấy') ||
    name.includes('đang đến lấy') ||
    name.includes('chờ ghn lấy')
  ) {
    return {
      category: 'not_scanned',
      label: rawStatusName || 'Chờ lấy hàng (Chưa scan)',
      isScanned: false
    };
  }

  // 5. Picking / Picked (Đã tiếp nhận bưu kiện)
  if (
    s === 'picked' || 
    s === 'storing' ||
    name.includes('lấy hàng thành công') || 
    name.includes('đã nhận hàng') ||
    name.includes('đã lấy hàng') ||
    name.includes('tiếp nhận')
  ) {
    return {
      category: 'scanned',
      label: rawStatusName || 'Đã lấy hàng & nhập bưu cục',
      isScanned: true
    };
  }

  // 6. In transit / Delivering
  if (
    s === 'transporting' ||
    s === 'sorting' ||
    s === 'delivering' ||
    s === 'money_collect_delivering' ||
    name.includes('trung chuyển') ||
    name.includes('đang giao') ||
    name.includes('đang phát') ||
    name.includes('nhập kho') ||
    name.includes('xuất kho') ||
    name.includes('sẵn sàng giao') ||
    name.includes('phân loại') ||
    name.includes('luân chuyển')
  ) {
    return {
      category: 'in_transit',
      label: rawStatusName || 'Đang vận chuyển',
      isScanned: true
    };
  }

  // 7. Error / Delivery fail / Exception / Damage / Lost
  if (
    s === 'delivery_fail' || 
    s === 'damage' || 
    s === 'lost' || 
    s === 'exception' ||
    name.includes('thất lạc') || 
    name.includes('hư hỏng') || 
    name.includes('không thành công') ||
    name.includes('thất bại') ||
    name.includes('sự cố')
  ) {
    return {
      category: 'error',
      label: rawStatusName || 'Sự cố vận chuyển',
      isScanned: true
    };
  }

  return {
    category: 'scanned',
    label: rawStatusName || 'Đã scan xử lý',
    isScanned: true
  };
}

function mapJNTStatus(topText: string, hasPickupScan: boolean = false) {
  const t = (topText || '').toLowerCase();

  // 1. Returned
  if (t.includes('chuyển hoàn') || t.includes('trả hàng') || t.includes('hoàn hàng') || t.includes('đang hoàn')) {
    return {
      category: 'returned',
      label: topText || 'Chuyển hoàn J&T',
      isScanned: true
    };
  }

  // 2. Delivered
  if (t.includes('đã ký nhận') || t.includes('ký nhận') || t.includes('giao hàng thành công') || t.includes('giao thành công')) {
    return {
      category: 'delivered',
      label: topText || 'Giao hàng thành công (Đã ký nhận)',
      isScanned: true
    };
  }

  // 3. Cancelled
  if (t.includes('hủy') || t.includes('huỷ')) {
    return {
      category: 'cancelled',
      label: topText || 'Đã hủy phiếu gửi J&T',
      isScanned: false
    };
  }

  // 4. Kiện vấn đề / Kiện khó / Sự cố giao hàng
  if (t.includes('kiện vấn đề') || t.includes('kiện khó') || t.includes('vấn đề')) {
    if (hasPickupScan) {
      return {
        category: 'in_transit',
        label: topText || 'Đang giao hàng (Kiện vấn đề / Hẹn giao lại)',
        isScanned: true
      };
    } else {
      return {
        category: 'not_scanned',
        label: topText || 'Chờ J&T lấy hàng (Kiện vấn đề lấy hàng / Kiện khó)',
        isScanned: false
      };
    }
  }

  // 5. Not scanned / Chờ lấy hàng
  if (t.includes('chờ lấy') || t.includes('chưa lấy') || t.includes('tạo đơn') || t.includes('tạo phiếu gửi') || t.includes('chờ nhận')) {
    return {
      category: 'not_scanned',
      label: topText || 'Chờ J&T lấy hàng (Chưa scan)',
      isScanned: false
    };
  }

  // 6. In transit
  if (t.includes('đang giao hàng') || t.includes('đang phát') || t.includes('sẵn sàng giao') || t.includes('đang giao') || t.includes('sẽ sớm được giao')) {
    return {
      category: 'in_transit',
      label: topText || 'Đang giao hàng',
      isScanned: true
    };
  }

  if (
    t.includes('đang chuyển hàng đến') || 
    t.includes('đã được chuyển đến') || 
    t.includes('ttkt') || 
    t.includes('kho trung chuyển') || 
    t.includes('đgp') ||
    t.includes('rời bưu cục') ||
    t.includes('xuất bưu cục') ||
    t.includes('nhập trung tâm') ||
    t.includes('xuất trung tâm') ||
    t.includes('lên xe') ||
    t.includes('đang vận chuyển') ||
    t.includes('đang luân chuyển') ||
    t.includes('đang chuyển kiện') ||
    t.includes('phân loại')
  ) {
    return {
      category: 'in_transit',
      label: topText || 'Đang trung chuyển',
      isScanned: true
    };
  }

  // 7. Scanned / Đã nhận hàng & nhập bưu cục
  if (
    t.includes('đã nhận hàng') || 
    (t.includes('nhân viên') && t.includes('đã nhận')) ||
    t.includes('nhận kiện hàng') || 
    t.includes('nhập bưu cục') || 
    t.includes('lấy hàng thành công') ||
    t.includes('đã lấy hàng') ||
    t.includes('tiếp nhận') ||
    t.includes('quét mã tiếp nhận')
  ) {
    return {
      category: 'scanned',
      label: topText || 'Đã lấy hàng & nhập bưu cục J&T',
      isScanned: true
    };
  }

  // 8. Error
  if (t.includes('không thành công') || t.includes('thất bại') || t.includes('sự cố')) {
    return {
      category: hasPickupScan ? 'error' : 'not_scanned',
      label: topText || 'Sự cố vận chuyển J&T',
      isScanned: hasPickupScan
    };
  }

  return {
    category: hasPickupScan ? 'scanned' : 'not_scanned',
    label: topText || (hasPickupScan ? 'Đang xử lý trên hệ thống J&T' : 'Chưa scan lấy hàng'),
    isScanned: hasPickupScan
  };
}

// Server-side smart memory cache
const liveCache = new Map<string, { data: any; expiresAt: number }>();

/**
 * Smart logistics cache TTL strategy:
 * - Completed/Terminal statuses (delivered, cancelled, returned): cache 4 hours
 * - In-transit / Delivering: cache 15 minutes
 * - Scanned / Picked up: cache 5 minutes
 * - Not scanned / Pickup pending / Issue: ONLY CACHE 30 SECONDS
 *   (Crucial: couriers can pick up parcels at any second during shift,
 *    must reflect live pickup immediately on subsequent scans!)
 */
function getSmartTTL(statusCategory?: string): number {
  switch (statusCategory) {
    case 'delivered':
    case 'cancelled':
    case 'returned':
      return 4 * 60 * 60 * 1000; // 4 hours
    case 'in_transit':
      return 15 * 60 * 1000;      // 15 minutes
    case 'scanned':
      return 5 * 60 * 1000;       // 5 minutes
    case 'not_scanned':
    case 'error':
    default:
      return 30 * 1000;           // 30 SECONDS ONLY
  }
}

function getFromCache(key: string, force: boolean = false) {
  if (force) {
    liveCache.delete(key);
    return null;
  }
  const item = liveCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    liveCache.delete(key);
    return null;
  }
  // Sanity check: if cached item was falsely marked as 'scanned' but has problem issue without scan time
  if (item.data) {
    const raw = (item.data.rawStatusText || '').toLowerCase();
    if ((raw.includes('kiện vấn đề') || raw.includes('kiện khó')) && !item.data.scannedAt && item.data.statusCategory === 'scanned') {
      item.data.statusCategory = 'not_scanned';
    }
  }
  return item.data;
}

function setInCache(key: string, data: any, ttlMs?: number) {
  const actualTtl = ttlMs !== undefined ? ttlMs : getSmartTTL(data?.statusCategory);
  liveCache.set(key, { data, expiresAt: Date.now() + actualTtl });
}

// Optimized non-blocking throttles with adaptive backoff
let ghnLastReqTime = 0;
let jtLastReqTime = 0;

async function throttleGHN() {
  const now = Date.now();
  const minInterval = 20; // 50 reqs/sec capacity
  const elapsed = now - ghnLastReqTime;
  if (elapsed < minInterval) {
    await new Promise(r => setTimeout(r, minInterval - elapsed));
  }
  ghnLastReqTime = Date.now();
}

let jtQueue: Promise<any> = Promise.resolve();
async function executeJTThrottled<T>(fn: () => Promise<T>): Promise<T> {
  const next = jtQueue.then(async () => {
    const minInterval = 120; // Controlled spacing for J&T anti-bot
    await new Promise(resolve => setTimeout(resolve, minInterval));
    return fn();
  });
  jtQueue = next.catch(() => {});
  return next;
}


function formatDate(input?: string | number | Date, includeSeconds: boolean = true): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return '';
    // If string is already formatted as DD/MM/YYYY with time, return as-is
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(trimmed)) {
      return trimmed;
    }
  }

  try {
    let d: Date;
    if (typeof input === 'number') {
      d = new Date(input < 10000000000 ? input * 1000 : input);
    } else if (input instanceof Date) {
      d = input;
    } else {
      const trimmed = String(input).trim();
      if (!trimmed) return '';
      if (/^\d+$/.test(trimmed)) {
        const num = Number(trimmed);
        d = new Date(num < 10000000000 ? num * 1000 : num);
      } else {
        d = new Date(trimmed);
      }
    }

    if (isNaN(d.getTime())) return String(input);

    // Format strictly in Asia/Ho_Chi_Minh timezone (Vietnam GMT+7)
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const { hour = '00', minute = '00', second = '00', day = '01', month = '01', year = '2026' } = map;
    return includeSeconds
      ? `${hour}:${minute}:${second} ${day}/${month}/${year}`
      : `${hour}:${minute} ${day}/${month}/${year}`;
  } catch {
    return String(input);
  }
}

// J&T Express HTML Multi-Parser (supports 1 to 10 bill codes in single response)
function parseJNTMultiHtml(html: string, expectedCodes: string[]): Record<string, { items: { time: string; text: string }[] }> {
  const results: Record<string, { items: { time: string; text: string }[] }> = {};

  for (const code of expectedCodes) {
    const cleanCode = code.trim().toUpperCase();
    results[cleanCode] = { items: [] };

    // Locate section for this specific billcode:
    // J&T renders: <input ... id="chck-${cleanCode}" ...> <div class="tab-content">...</div>
    let sectionHtml = '';
    const chckIndex = html.indexOf('chck-' + cleanCode);
    if (chckIndex !== -1) {
      const tabContentStart = html.indexOf('class="tab-content"', chckIndex);
      if (tabContentStart !== -1) {
        const nextChck = html.indexOf('type="checkbox" id="chck-', tabContentStart);
        if (nextChck !== -1) {
          sectionHtml = html.substring(tabContentStart, nextChck);
        } else {
          sectionHtml = html.substring(tabContentStart, tabContentStart + 25000);
        }
      }
    }

    if (!sectionHtml) {
      const codeIndex = html.indexOf(cleanCode);
      if (codeIndex !== -1) {
        sectionHtml = html.substring(codeIndex, codeIndex + 25000);
      }
    }

    // If single code was queried and no accordion was rendered
    if (!sectionHtml && expectedCodes.length === 1) {
      sectionHtml = html;
    }

    if (!sectionHtml) continue;

    const blocks = sectionHtml.split(/class=[\"']result-vandon-item/i);
    const items: { time: string; text: string }[] = [];
    if (blocks.length > 1) {
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const timeMatch = block.match(/(\d{2}:\d{2}(?::\d{2})?)/);
        const dateMatch = block.match(/(\d{4}-\d{2}-\d{2})/) || block.match(/(\d{2}\/\d{2}\/\d{4})/);
        
        let rawText = "";
        const calendarIndex = block.indexOf("calendar-clear-outline");
        if (calendarIndex !== -1) {
          const afterCalendar = block.substring(calendarIndex);
          const divMatch = afterCalendar.match(/<div>([\s\S]*?)<\/div>/);
          if (divMatch) {
            rawText = divMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          }
        }

        if (!rawText) {
          const match = block.match(/<div>\s*([\s\S]*?(?:【|đã|nhận|giao|bưu cục|kiện)[\s\S]*?)<\/div>/i);
          if (match) {
            rawText = match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          }
        }

        if (rawText && (timeMatch || dateMatch)) {
          let formattedDate = "";
          if (dateMatch) {
            if (dateMatch[1].includes('-')) {
              const dateParts = dateMatch[1].split('-');
              formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : dateMatch[1];
            } else {
              formattedDate = dateMatch[1];
            }
          }
          const timeStr = timeMatch ? timeMatch[1] : '';
          const finalTime = timeStr && formattedDate ? `${timeStr} ${formattedDate}` : (timeStr || formattedDate || 'Gần đây');
          
          items.push({
            time: finalTime,
            text: rawText
          });
        }
      }
    }
    results[cleanCode] = { items };
  }

  return results;
}

// J&T Express Live Multi-Tracking (handles batches up to 10 codes in a single request)
async function fetchJNTBatchLive(
  billCodes: string[], 
  cellphone?: string,
  force: boolean = false
): Promise<Record<string, { success: boolean; data?: any; error?: string; carrier?: string }>> {
  const cleanCodes = Array.from(new Set(billCodes.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  if (cleanCodes.length === 0) return {};

  const cleanPhone = cellphone ? cellphone.replace(/\D/g, '').slice(-4) : '';
  const results: Record<string, { success: boolean; data?: any; error?: string; carrier?: string }> = {};
  const uncachedCodes: string[] = [];

  // Check cache first (bypass if force is true)
  for (const code of cleanCodes) {
    let cachedData = null;
    if (!force) {
      const candidateKeys = [
        cleanPhone ? `jnt:${code}:${cleanPhone}` : '',
        `jnt:${code}:8836`,
        `jnt:${code}:8036`,
        `jnt:${code}:default`
      ].filter(Boolean);

      for (const key of candidateKeys) {
        const cached = getFromCache(key);
        if (cached) {
          cachedData = cached;
          break;
        }
      }
    }

    if (cachedData) {
      results[code] = { success: true, data: cachedData };
    } else {
      uncachedCodes.push(code);
    }
  }

  if (uncachedCodes.length === 0) {
    return results;
  }

  // Priority phone suffixes to test: custom phone -> 8836 -> 8036
  const phonesToTry: string[] = [];
  if (cleanPhone) phonesToTry.push(cleanPhone);
  if (!phonesToTry.includes('8836')) phonesToTry.push('8836');
  if (!phonesToTry.includes('8036')) phonesToTry.push('8036');

  // J&T Express official limit: max 10 bill codes per HTTP request
  const BATCH_SIZE = 10;
  for (let i = 0; i < uncachedCodes.length; i += BATCH_SIZE) {
    const batch = uncachedCodes.slice(i, i + BATCH_SIZE);
    let remainingInBatch = [...batch];

    for (const phone of phonesToTry) {
      if (remainingInBatch.length === 0) break;

      const targetUrl = `https://jtexpress.vn/vi/tracking?type=track&billcode=${encodeURIComponent(remainingInBatch.join(','))}${phone ? `&cellphone=${encodeURIComponent(phone)}` : ''}`;

      let html = '';
      try {
        html = await executeJTThrottled(async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7000);
          try {
            const response = await fetch(targetUrl, {
              signal: controller.signal,
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
                "Referer": "https://jtexpress.vn/vi/tracking"
              }
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              return await response.text();
            } else if (response.status === 429) {
              await new Promise(r => setTimeout(r, 400));
              const retryRes = await fetch(targetUrl, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "Referer": "https://jtexpress.vn/vi/tracking"
                }
              });
              if (retryRes.ok) return await retryRes.text();
            }
          } catch {
            clearTimeout(timeoutId);
          }
          return '';
        });
      } catch {
        html = '';
      }

      if (html) {
        const parsedBatch = parseJNTMultiHtml(html, remainingInBatch);
        const resolvedCodes: string[] = [];

        for (const code of remainingInBatch) {
          const parsed = parsedBatch[code];
          if (parsed && parsed.items.length > 0) {
            const topItem = parsed.items[0];

            // Find actual pickup scan event (ignoring issue logs e.g. Kiện Vấn Đề)
            const pickupItem = parsed.items.slice().reverse().find(item => {
              const txt = item.text.toLowerCase();
              const isIssue = txt.includes('kiện vấn đề') || 
                              txt.includes('kiện khó') || 
                              txt.includes('vấn đề') || 
                              txt.includes('tạo đơn') || 
                              txt.includes('khởi tạo') ||
                              txt.includes('chuẩn bị');
              if (isIssue) return false;

              return txt.includes('đã nhận hàng') || 
                     (txt.includes('nhân viên') && txt.includes('đã nhận')) ||
                     txt.includes('nhận kiện hàng') || 
                     txt.includes('nhập bưu cục') || 
                     txt.includes('lấy hàng thành công') || 
                     txt.includes('đã lấy hàng') || 
                     txt.includes('tiếp nhận') || 
                     txt.includes('quét mã tiếp nhận') || 
                     txt.includes('picked up');
            });

            const validTransitItem = parsed.items.slice().reverse().find(item => {
              const txt = item.text.toLowerCase();
              const isExcluded = txt.includes('kiện vấn đề') || 
                                 txt.includes('kiện khó') || 
                                 txt.includes('vấn đề') || 
                                 txt.includes('tạo đơn') || 
                                 txt.includes('được tạo') || 
                                 txt.includes('chờ lấy') ||
                                 txt.includes('chuẩn bị');
              return !isExcluded;
            });

            const hasPickup = Boolean(pickupItem || validTransitItem);
            const scannedTime = pickupItem ? pickupItem.time : (validTransitItem ? validTransitItem.time : undefined);
            const mapped = mapJNTStatus(topItem.text, hasPickup);

            const timeline = parsed.items.map(item => {
              const locMatch = item.text.match(/bưu cục\s*【(.*?)】/i) || 
                               item.text.match(/đến\s*【(.*?)】/i) || 
                               item.text.match(/【((?:TTKT|ĐGP|\([A-Z0-9_-]+\)).*?)】/i) || 
                               item.text.match(/【(.*?)】/);
              const extractedLoc = locMatch ? locMatch[1].trim() : '';
              return {
                time: item.time,
                statusText: item.text,
                location: extractedLoc || 'Mạng lưới J&T Express',
                description: ''
              };
            });

            const resultData = {
              carrier: 'jt',
              statusCategory: mapped.category,
              rawStatusText: topItem.text,
              statusDetail: topItem.text,
              updatedAt: topItem.time,
              scannedAt: scannedTime,
              recipientLocation: timeline[0]?.location !== 'Mạng lưới J&T Express' ? timeline[0]?.location : undefined,
              timeline
            };

            if (phone) setInCache(`jnt:${code}:${phone}`, resultData);
            setInCache(`jnt:${code}:default`, resultData);

            results[code] = { success: true, data: resultData };
            resolvedCodes.push(code);
          }
        }

        remainingInBatch = remainingInBatch.filter(c => !resolvedCodes.includes(c));
      }
    }

    // Any remaining codes in this batch had no new data on J&T portal => Check DB first before falling back to not_scanned
    for (const code of remainingInBatch) {
      let existingTimeline: any[] | null = null;
      try {
        existingTimeline = await getOrderTimeline(code);
      } catch {}

      if (existingTimeline && existingTimeline.length > 0) {
        const pickupItem = existingTimeline.slice().reverse().find(item => {
          const txt = (item.statusText || '').toLowerCase();
          const isIssue = txt.includes('kiện vấn đề') || txt.includes('kiện khó') || txt.includes('tạo đơn') || txt.includes('chuẩn bị');
          if (isIssue) return false;
          return txt.includes('đã nhận hàng') || 
                 (txt.includes('nhân viên') && txt.includes('đã nhận')) ||
                 txt.includes('nhận kiện hàng') || 
                 txt.includes('nhập bưu cục') || 
                 txt.includes('lấy hàng thành công') || 
                 txt.includes('đã lấy hàng') || 
                 txt.includes('tiếp nhận') || 
                 txt.includes('quét mã tiếp nhận') ||
                 txt.includes('picked up');
        });

        const topItem = existingTimeline[0];
        const hasPickup = Boolean(pickupItem);
        const mapped = mapJNTStatus(topItem?.statusText || '', hasPickup);

        if (hasPickup || mapped.category !== 'not_scanned') {
          const preservedData = {
            carrier: 'jt',
            statusCategory: mapped.category,
            rawStatusText: topItem?.statusText || 'Đang vận chuyển (J&T)',
            statusDetail: topItem?.statusText || '',
            updatedAt: topItem?.time,
            scannedAt: pickupItem ? pickupItem.time : undefined,
            timeline: existingTimeline
          };
          results[code] = { success: true, data: preservedData };
          continue;
        }
      }

      const isCargo = code.startsWith('530') || code.startsWith('53');
      results[code] = {
        success: true,
        carrier: 'jt',
        data: {
          carrier: 'jt',
          statusCategory: 'not_scanned',
          rawStatusText: 'Chờ J&T lấy hàng (Chưa scan)',
          statusDetail: isCargo 
            ? "Chưa có dữ liệu hành trình trên J&T Cargo (Đơn hàng vừa xuất kho WMS, chờ bưu cục quét nhận)"
            : "Chưa có dữ liệu trên cổng J&T Express (Mã đã xuất kho WMS, chờ bưu tá quét nhận)",
          timeline: []
        }
      };
    }
  }

  return results;
}

// Single J&T Express Live Tracking (delegates to batch runner)
async function fetchJNTLive(billCode: string, cellphone?: string): Promise<{ success: boolean; data?: any; error?: string; carrier?: string }> {
  const cleanBillCode = billCode.trim().toUpperCase();
  const batchRes = await fetchJNTBatchLive([cleanBillCode], cellphone);
  if (batchRes[cleanBillCode]) {
    return batchRes[cleanBillCode];
  }

  try {
    const existingTimeline = await getOrderTimeline(cleanBillCode);
    if (existingTimeline && existingTimeline.length > 0) {
      const pickupItem = existingTimeline.slice().reverse().find(item => {
        const txt = (item.statusText || '').toLowerCase();
        return txt.includes('đã nhận hàng') || (txt.includes('nhân viên') && txt.includes('đã nhận')) || txt.includes('tiếp nhận');
      });
      const topItem = existingTimeline[0];
      const hasPickup = Boolean(pickupItem);
      const mapped = mapJNTStatus(topItem?.statusText || '', hasPickup);
      return {
        success: true,
        carrier: 'jt',
        data: {
          carrier: 'jt',
          statusCategory: mapped.category,
          rawStatusText: topItem?.statusText || 'Đang vận chuyển (J&T)',
          statusDetail: topItem?.statusText || '',
          updatedAt: topItem?.time,
          scannedAt: pickupItem ? pickupItem.time : undefined,
          timeline: existingTimeline
        }
      };
    }
  } catch {}

  return {
    success: true,
    carrier: 'jt',
    data: {
      carrier: 'jt',
      statusCategory: 'not_scanned',
      rawStatusText: 'Chờ J&T lấy hàng (Chưa scan)',
      statusDetail: 'Mã vận đơn chưa phát sinh dữ liệu quét tiếp nhận trên cổng J&T Express (Chờ bưu tá lấy hàng)',
      timeline: []
    }
  };
}

// ----------------------------------------------------------------
// J&T Cargo Live Tracking (office.jtcargo.com.vn API)
// For bill codes starting with "530" or identified as jt_cargo
// ----------------------------------------------------------------
function mapJNTCargoStatus(statusCode: number, statusText: string): { category: string; label: string; isScanned: boolean } {
  const s = (statusText || '').toLowerCase().trim();
  const code = statusCode;

  // Delivered (code 60 = Giao hàng thành công)
  if (code === 60 || s.includes('giao hàng thành công') || s.includes('giao thành công') || s.includes('đã giao') || s.includes('ký nhận')) {
    return { category: 'delivered', label: statusText || 'Giao hàng thành công', isScanned: true };
  }

  // Returned (code 70 = Chuyển hoàn)
  if (code === 70 || s.includes('chuyển hoàn') || s.includes('hoàn hàng') || s.includes('trả hàng') || s.includes('đang hoàn')) {
    return { category: 'returned', label: statusText || 'Chuyển hoàn J&T Cargo', isScanned: true };
  }

  // Cancelled
  if (s.includes('hủy') || s.includes('huỷ') || s.includes('cancel')) {
    return { category: 'cancelled', label: statusText || 'Đơn hàng đã hủy', isScanned: false };
  }

  // Picked up (code 10 = Đã nhận hàng / lấy hàng)
  if (code === 10 || code === 201 || s.includes('đã nhận hàng') || s.includes('lấy hàng') || s.includes('tiếp nhận')) {
    return { category: 'scanned', label: statusText || 'J&T Cargo đã lấy hàng', isScanned: true };
  }

  // In transit (code 50 = Đang vận chuyển, 90 = Đến trung tâm)
  if (
    code === 50 || code === 90 || code === 203 ||
    s.includes('đang vận chuyển') || s.includes('vận chuyển') ||
    s.includes('đến trung tâm') || s.includes('hub') ||
    s.includes('rời khỏi') || s.includes('đã đến') ||
    s.includes('đang giao') || s.includes('sắp giao')
  ) {
    return { category: 'in_transit', label: statusText || 'Đang vận chuyển (J&T Cargo)', isScanned: true };
  }

  // Error / Exception
  if (s.includes('thất lạc') || s.includes('hư hỏng') || s.includes('sự cố') || s.includes('bất thường')) {
    return { category: 'error', label: statusText || 'Sự cố vận chuyển J&T Cargo', isScanned: true };
  }

  // Default: treat as scanned if code > 0
  return {
    category: code > 0 ? 'scanned' : 'not_scanned',
    label: statusText || (code > 0 ? 'Đang xử lý (J&T Cargo)' : 'Chưa có dữ liệu J&T Cargo'),
    isScanned: code > 0
  };
}

async function fetchJNTCargoLive(billCode: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string; carrier?: string }> {
  const cleanCode = billCode.trim().toUpperCase();
  const cacheKey = `jnt_cargo:${cleanCode}`;

  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  }

  const CARGO_BASE_URL = 'https://office.jtcargo.com.vn';
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Referer': 'https://www.jtcargo.vn/',
    'Origin': 'https://www.jtcargo.vn',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
    'Content-Type': 'application/json;charset=UTF-8',
    'language': 'VN',
    'authToken': '',
    'Cache-Control': 'max-age=2, must-revalidate'
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(`${CARGO_BASE_URL}/official/waybill/trackingCustomerByWaybillNo`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: JSON.stringify({ waybillNo: cleanCode })
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 500));
          continue;
        }
        return { success: false, error: `J&T Cargo API HTTP ${response.status}` };
      }

      const json = await response.json() as any;

      // API returns { code: 1, succ: true, data: [...] }
      if (!json.succ || !Array.isArray(json.data) || json.data.length === 0) {
        return {
          success: true,
          data: {
            carrier: 'jt_cargo',
            statusCategory: 'not_scanned',
            rawStatusText: 'Chưa có dữ liệu J&T Cargo',
            statusDetail: 'Mã vận đơn chưa được ghi nhận trên hệ thống J&T Cargo (Chờ bưu cục quét nhận)',
            timeline: []
          }
        };
      }

      const waybillData = json.data[0];
      const details: any[] = waybillData.details || [];

      // Build timeline (details[0] = most recent)
      const timeline = details.map((d: any) => {
        const locParts = [d.scanNetworkCity, d.scanNetworkName].filter(Boolean);
        const location = locParts.length > 0 ? locParts.join(' - ') : 'Mạng lưới J&T Cargo';
        return {
          time: formatDate(d.scanTime),
          statusText: d.customerTracking || d.status || '',
          location,
          description: d.scanByName ? `Nhân viên: ${d.scanByName}` : ''
        };
      });

      // Latest status = details[0]
      const latestDetail = details[0];
      const latestStatusCode = latestDetail?.code || latestDetail?.change || 0;
      const latestStatusText = latestDetail?.status || '';
      const latestCustomerTracking = latestDetail?.customerTracking || latestStatusText;

      const mapped = mapJNTCargoStatus(latestStatusCode, latestStatusText);

      // Find pickup event (status "Đã nhận hàng" / code 10 / 201)
      const pickupEvent = details.slice().reverse().find((d: any) =>
        d.code === 10 || d.code === 201 || (d.status || '').includes('Đã nhận hàng') || (d.status || '').includes('lấy hàng')
      );
      const scannedAt = pickupEvent ? formatDate(pickupEvent.scanTime) : (mapped.isScanned ? formatDate(latestDetail?.scanTime) : undefined);

      // Receiver city info
      const recipientInfo = waybillData.receiverCityName
        ? `Đến: ${waybillData.receiverCityName}${waybillData.receiverProvinceName ? ` (${waybillData.receiverProvinceName})` : ''}`
        : undefined;

      // Extra info
      const extraInfo: string[] = [];
      if (waybillData.expressTypeName) extraInfo.push(`Dịch vụ: ${waybillData.expressTypeName}`);
      if (waybillData.packageTotalWeight) extraInfo.push(`Trọng lượng: ${waybillData.packageTotalWeight} kg`);
      if (waybillData.packageNumber) extraInfo.push(`Số kiện: ${waybillData.packageNumber}`);

      const statusDetail = latestCustomerTracking || mapped.label;

      const resultData = {
        carrier: 'jt_cargo',
        statusCategory: mapped.category,
        rawStatusText: latestStatusText || mapped.label,
        statusDetail,
        updatedAt: latestDetail ? formatDate(latestDetail.scanTime) : undefined,
        scannedAt,
        recipientLocation: recipientInfo,
        extraInfo: extraInfo.join(' | ') || undefined,
        timeline
      };

      setInCache(cacheKey, resultData);
      return { success: true, data: resultData };

    } catch (err: any) {
      if (attempt === 1) {
        return { success: false, error: err.message ? `Lỗi kết nối J&T Cargo: ${err.message}` : 'Lỗi kết nối cổng J&T Cargo' };
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return { success: false, error: 'Hệ thống J&T Cargo không phản hồi' };
}

// J&T Cargo Batch Live Tracking (multiple bill codes)
async function fetchJNTCargoBatchLive(
  billCodes: string[],
  force: boolean = false
): Promise<Record<string, { success: boolean; data?: any; error?: string; carrier?: string }>> {
  const cleanCodes = Array.from(new Set(billCodes.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  if (cleanCodes.length === 0) return {};

  const results: Record<string, { success: boolean; data?: any; error?: string; carrier?: string }> = {};

  // Run in parallel with limited concurrency (max 5 at once to avoid rate limiting)
  const CONCURRENCY = 5;
  for (let i = 0; i < cleanCodes.length; i += CONCURRENCY) {
    const chunk = cleanCodes.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (code) => {
        results[code] = await fetchJNTCargoLive(code, force);
      })
    );
    if (i + CONCURRENCY < cleanCodes.length) {
      await new Promise(r => setTimeout(r, 200)); // Brief pause between batches
    }
  }

  return results;
}

// GHN (Giao Hàng Nhanh) Live Tracking
async function fetchGHNLive(orderCode: string, cellphone?: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanCode = orderCode.trim().toUpperCase();
  const cleanPhone = (cellphone || '').replace(/\D/g, '').slice(-4);
  const cacheKey = `ghn:${cleanCode}:${cleanPhone}`;
  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await throttleGHN();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const requestBody: any = { order_code: cleanCode };
      if (cleanPhone) {
        requestBody.phone_verify = cleanPhone;
      }

      const response = await fetch("https://fe-online-gateway.ghn.vn/order-tracking/public-api/client/tracking-logs", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Origin": "https://ghn.vn",
          "Referer": "https://ghn.vn/"
        },
        body: JSON.stringify(requestBody)
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const backoffMs = 350 * Math.pow(2, attempt) + Math.floor(Math.random() * 150);
        await new Promise(r => setTimeout(r, backoffMs));
        continue;
      }

      const json = (await response.json()) as any;
      if (response.ok && json.code === 200 && json.data && json.data.order_info) {
        const info = json.data.order_info;
        const logs = json.data.tracking_logs || [];
        const mapped = mapGHNStatus(info.status, info.status_name);

        let scannedAtTime: string | undefined;
        const scanLog = logs.find((l: any) => l.status !== 'ready_to_pick' && l.action_at);
        if (scanLog) {
          scannedAtTime = formatDate(scanLog.action_at);
        } else if (info.picktime) {
          scannedAtTime = formatDate(info.picktime);
        }

        const timeline = logs.slice().reverse().map((l: any) => ({
          time: formatDate(l.action_at),
          statusText: l.status_name,
          location: l.location?.address || '',
          description: l.executor?.name ? `Nhân viên xử lý: ${l.executor.name}` : ''
        }));

        const topLog = logs[logs.length - 1];
        const detail = topLog?.location?.address || `Trạng thái: ${info.status_name}`;

        const resultData = {
          carrier: 'ghn',
          statusCategory: mapped.category,
          rawStatusText: info.status_name || mapped.label,
          statusDetail: detail,
          scannedAt: mapped.isScanned ? (scannedAtTime || formatDate(new Date().toISOString())) : undefined,
          recipientLocation: info.to_address,
          pickupAddress: info.from_address,
          timeline
        };

        setInCache(cacheKey, resultData);

        return {
          success: true,
          data: resultData
        };
      } else {
        if (json.code_message === 'PHONE_VERIFY_REQUIRED' || json.message?.includes('phone verify param') || json.code_message === 'PHONE_VERIFY_FAIL') {
          const detailMsg = json.code_message === 'PHONE_VERIFY_FAIL'
            ? 'Mã vận đơn tồn tại trên GHN (4 số cuối SĐT chưa khớp)'
            : 'Mã vận đơn hợp lệ trên GHN (GHN bật bảo mật 4 số cuối SĐT)';

          const resultData = {
            carrier: 'ghn',
            statusCategory: 'not_scanned',
            rawStatusText: 'Đã tạo đơn trên GHN (Bảo mật SĐT)',
            statusDetail: detailMsg,
            scannedAt: undefined,
            timeline: [
              {
                time: formatDate(new Date().toISOString()),
                statusText: 'Đơn hàng tồn tại trên hệ thống GHN',
                location: 'Cổng GHN',
                description: 'Bưu kiện đã được ghi nhận trên hệ thống GHN. Cần 4 số cuối SĐT nếu muốn mở khóa chi tiết người nhận và bưu tá giao.'
              }
            ]
          };

          return {
            success: true,
            data: resultData
          };
        }

        const errorMsg = json.message || 'Không tìm thấy thông tin đơn hàng trên GHN';
        return {
          success: false,
          error: errorMsg
        };
      }
    } catch (err: any) {
      if (attempt === 1) {
        return {
          success: false,
          error: err.message ? `Lỗi kết nối tới GHN: ${err.message}` : 'Lỗi kết nối cổng GHN'
        };
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    success: false,
    error: 'Hệ thống GHN không phản hồi, vui lòng thử lại'
  };
}

// SPX (Shopee Express) Live Tracking
function signSPXTracking(trackingNumber: string) {
  const ts = Math.floor(Date.now() / 1000);
  const secret = "MGViZmZmZTYzZDJhNDgxY2Y1N2ZlN2Q1ZWJkYzlmZDY=";
  const hash = crypto.createHash("sha256").update(`${trackingNumber}${ts}${secret}`).digest("hex");
  return `${trackingNumber}|${ts}${hash}`;
}

async function fetchSPXLive(orderCode: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanCode = orderCode.trim().toUpperCase();
  const cacheKey = `spx:${cleanCode}`;
  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      let records: any[] = [];
      let slsTn = '';
      let clientOrderId = '';
      let recipientName = '';
      let fleetData: any = null;

      // 1. Query official SPX open order info API (used directly on spx.vn/track and spx.vn/vi)
      try {
        const orderInfoUrl = `https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(cleanCode)}&language_code=vi`;
        const ctrl1 = new AbortController();
        const tId1 = setTimeout(() => ctrl1.abort(), 6000);
        const res1 = await fetch(orderInfoUrl, {
          signal: ctrl1.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": `https://spx.vn/track?${cleanCode}`,
            "Origin": "https://spx.vn",
            "Accept": "application/json, text/plain, */*"
          }
        });
        clearTimeout(tId1);
        if (res1.ok) {
          const json1 = await res1.json();
          if (json1.retcode === 0 && json1.data?.sls_tracking_info) {
            const info = json1.data.sls_tracking_info;
            slsTn = info.sls_tn || '';
            clientOrderId = info.client_order_id || '';
            recipientName = info.receiver_name || '';
            if (Array.isArray(info.records) && info.records.length > 0) {
              records = info.records;
            }
          }
        }
      } catch (err: any) {
        // Fallback to fleet_order below
      }

      // 2. Query SPX fleet order tracking API with signed HMAC token
      try {
        const signedParam = signSPXTracking(cleanCode);
        const fleetUrl = `https://spx.vn/api/v2/fleet_order/tracking/search?sls_tracking_number=${encodeURIComponent(signedParam)}`;
        const ctrl2 = new AbortController();
        const tId2 = setTimeout(() => ctrl2.abort(), 6000);
        const res2 = await fetch(fleetUrl, {
          signal: ctrl2.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": `https://spx.vn/track?${cleanCode}`,
            "Origin": "https://spx.vn",
            "x-language": "vi",
            "Accept": "application/json, text/plain, */*"
          }
        });
        clearTimeout(tId2);
        if (res2.ok) {
          const json2 = await res2.json();
          if (json2.retcode === 0 && json2.data) {
            fleetData = json2.data;
            if (!recipientName && fleetData.recipient_name) {
              recipientName = fleetData.recipient_name;
            }
          }
        }
      } catch (err: any) {
        // Continue with available data
      }

      const trackingList = Array.isArray(fleetData?.tracking_list) ? fleetData.tracking_list : [];
      const currentStatus = fleetData?.current_status || '';

      if (records.length === 0 && trackingList.length === 0 && !currentStatus) {
        return {
          success: false,
          error: "Không tìm thấy dữ liệu vận đơn trên cổng SPX Express (spx.vn)"
        };
      }

      // Construct timeline favoring detailed records from get_order_info
      let timeline: any[] = [];
      if (records.length > 0) {
        timeline = records.map((item: any) => {
          const locName = item.current_location?.location_name || item.current_location?.full_address || '';
          return {
            time: item.actual_time ? formatDate(item.actual_time) : '',
            statusText: (item.buyer_description || item.description || item.tracking_name || '').trim(),
            location: locName || 'Hệ thống Shopee Express (SPX)',
            description: item.tracking_code ? `Mã sự kiện: ${item.tracking_code}` : ''
          };
        });
      } else if (trackingList.length > 0) {
        timeline = trackingList.map((item: any) => {
          const locMatch = item.message ? item.message.match(/\[(.*?)\]/) : null;
          return {
            time: item.timestamp ? formatDate(item.timestamp) : '',
            statusText: item.message || item.status || 'Cập nhật hành trình',
            location: locMatch ? locMatch[1].trim() : 'Hệ thống Shopee Express (SPX)',
            description: ''
          };
        });
      }

      const latestRecord = records[0];
      const latestCode = latestRecord?.tracking_code || '';
      const latestMilestone = latestRecord?.milestone_code || 0;
      const latestDesc = (latestRecord?.buyer_description || latestRecord?.description || timeline[0]?.statusText || '').toLowerCase();

      const hasDelivered = currentStatus === 'Delivered' || 
                           latestCode === 'F980' || 
                           latestMilestone === 8 ||
                           latestDesc.includes('giao hàng thành công') || 
                           latestDesc.includes('đã giao') || 
                           latestDesc.includes('ký nhận') ||
                           trackingList.some((t: any) => t.status === 'Delivered' || t.message?.toLowerCase().includes('giao hàng thành công'));

      const hasCancelled = currentStatus?.toLowerCase() === 'cancelled' || 
                           latestCode === 'F950' ||
                           latestCode.startsWith('C') ||
                           latestMilestone === 9 ||
                           (latestRecord?.milestone_name || '').toLowerCase().includes('cancel') ||
                           (latestRecord?.tracking_name || '').toLowerCase().includes('cancel') ||
                           latestDesc.includes('hủy') || 
                           latestDesc.includes('huỷ') ||
                           latestDesc.includes('cancel') ||
                           records.some((r: any) => 
                             r.tracking_code === 'F950' || 
                             (r.tracking_code || '').startsWith('C') || 
                             r.milestone_code === 9 || 
                             (r.milestone_name || '').toLowerCase().includes('cancel') ||
                             (r.tracking_name || '').toLowerCase().includes('cancel') ||
                             (r.buyer_description || '').toLowerCase().includes('hủy') ||
                             (r.buyer_description || '').toLowerCase().includes('huỷ') ||
                             (r.seller_description || '').toLowerCase().includes('hủy') ||
                             (r.seller_description || '').toLowerCase().includes('huỷ')
                           ) ||
                           trackingList.some((t: any) => 
                             (t.status || '').toLowerCase() === 'cancelled' || 
                             (t.message || '').toLowerCase().includes('hủy') || 
                             (t.message || '').toLowerCase().includes('huỷ') ||
                             (t.message || '').toLowerCase().includes('cancel')
                           );

      const hasReturned = currentStatus === 'Returned' || 
                          ['F997', 'F671', 'F999'].includes(latestCode) ||
                          latestDesc.includes('hoàn') || 
                          latestDesc.includes('trả hàng') ||
                          trackingList.some((t: any) => t.status === 'Returned' || t.message?.toLowerCase().includes('hoàn') || t.message?.toLowerCase().includes('trả hàng'));

      const isDeliveringOrTransit = ['Delivering', 'Courier Delivery', 'Assigned', 'Transporting', 'Pending', 'Sorting', 'LMHub_Receive_Done', 'SOC_Receive_Done', 'Hub_Inbound_Done'].includes(currentStatus) ||
                                   ['F650', 'F699', 'F700', 'F800', 'F850'].includes(latestCode) ||
                                   /^F[4-8]\d{2}$/.test(latestCode) ||
                                   latestDesc.includes('đang giao') || 
                                   latestDesc.includes('đang phát') || 
                                   latestDesc.includes('phân loại') || 
                                   latestDesc.includes('phân tuyến') || 
                                   latestDesc.includes('luân chuyển') || 
                                   latestDesc.includes('đến kho') ||
                                   latestDesc.includes('rời kho') ||
                                   latestDesc.includes('đến bưu cục') ||
                                   latestDesc.includes('rời bưu cục') ||
                                   latestDesc.includes('lên xe') ||
                                   latestDesc.includes('sắp xếp tài xế') ||
                                   latestDesc.includes('sớm được giao') ||
                                   latestDesc.includes('sẵn sàng trung chuyển') ||
                                   latestDesc.includes('đến trạm') ||          // Đã đến trạm giao hàng cuối
                                   latestDesc.includes('trạm giao hàng') ||    // Trạm giao hàng khu vực
                                   latestDesc.includes('sẽ được giao') ||      // Sẽ được giao trong vòng...
                                   latestDesc.includes('đang trên đường giao') ||
                                   latestDesc.includes('shipper đang') ||
                                   latestDesc.includes('bưu tá đang') ||
                                   trackingList.some((t: any) => {
                                     const m = (t.message || '').toLowerCase();
                                     return m.includes('đang giao') || m.includes('đang phát') || m.includes('phân loại') || m.includes('phân tuyến') || m.includes('luân chuyển') || m.includes('đến kho') || m.includes('rời kho') || m.includes('đến bưu cục') || m.includes('rời bưu cục') || m.includes('lên xe') || m.includes('đến trạm') || m.includes('trạm giao hàng') || m.includes('sẽ được giao') || m.includes('sớm được giao');
                                   });

      const isPickupFailed = latestCode === 'F001' || 
                             latestDesc.includes('lấy hàng không thành công') ||
                             latestDesc.includes('chưa lấy được');

      const hasPickedUp = !isPickupFailed && (
                          ['FMHub_Pickup_Done', 'Picked Up', 'Pending_Receive', 'Pickup_Done', 'Pickup_Success', 'FMHub_Pickup'].includes(currentStatus) ||
                          ['F100', 'F101', 'F050'].includes(latestCode) ||
                          (currentStatus.toLowerCase().includes('pickup') && !currentStatus.toLowerCase().includes('fail')) ||
                          (currentStatus.toLowerCase().includes('picked') && !currentStatus.toLowerCase().includes('fail')) ||
                          latestDesc.includes('lấy hàng thành công') || 
                          latestDesc.includes('đã lấy hàng') || 
                          latestDesc.includes('đã nhận') || 
                          latestDesc.includes('tiếp nhận') || 
                          latestDesc.includes('quét mã tiếp nhận') ||
                          trackingList.some((t: any) => {
                            const m = (t.message || '').toLowerCase();
                            return t.status !== 'Created' && !m.includes('không thành công') && (m.includes('đã lấy hàng') || m.includes('đã nhận') || m.includes('tiếp nhận') || m.includes('lấy hàng thành công'));
                          }));

      // Find earliest pickup timestamp (must NOT be creation or failed pickup attempt)
      let pickTime: string | undefined = undefined;
      const pickupRecord = records.slice().reverse().find((r: any) => !['F000', 'A000', 'F001'].includes(r.tracking_code) && r.actual_time);
      if (pickupRecord?.actual_time) {
        pickTime = formatDate(pickupRecord.actual_time);
      } else {
        const pickEvent = trackingList.slice().reverse().find((t: any) => t.status !== 'Created' && !t.message?.toLowerCase().includes('không thành công') && t.timestamp);
        if (pickEvent?.timestamp) {
          pickTime = formatDate(pickEvent.timestamp);
        }
      }

      let statusCategory = 'not_scanned';
      let rawStatusText = timeline[0]?.statusText || 'Người bán đang chuẩn bị hàng';
      let statusDetail = 'Đơn hàng mới tạo mã vận đơn trên Shopee, SPX chưa quét nhận hàng';
      let scannedAt: string | undefined = undefined;

      if (hasDelivered) {
        statusCategory = 'delivered';
        rawStatusText = timeline[0]?.statusText || 'Giao hàng thành công (SPX)';
        statusDetail = 'Bưu kiện đã được phát thành công tới người nhận';
        scannedAt = pickTime;
      } else if (hasCancelled) {
        statusCategory = 'cancelled';
        const cancelRecord = records.find((r: any) => 
          r.tracking_code === 'F950' || 
          r.tracking_code === 'F585' ||
          (r.buyer_description || '').toLowerCase().includes('hủy') ||
          (r.buyer_description || '').toLowerCase().includes('huỷ') ||
          (r.seller_description || '').toLowerCase().includes('hủy') ||
          (r.seller_description || '').toLowerCase().includes('huỷ') ||
          (r.milestone_name || '').toLowerCase().includes('cancel')
        );
        const cancelDesc = cancelRecord?.buyer_description || cancelRecord?.seller_description || cancelRecord?.tracking_name;

        // If the latest event is return warehouse flow (F671, F677) after cancel
        if (latestCode === 'F671' || latestCode === 'F677' || (latestDesc.includes('đến kho') && timeline[0]?.location)) {
          const loc = timeline[0]?.location ? ` [${timeline[0].location}]` : '';
          rawStatusText = `Đã hủy - Đang chuyển kho hoàn${loc}`;
          statusDetail = cancelDesc 
            ? `SPX xác nhận hủy đơn: "${cancelDesc}". Kiện đang xử lý tại kho hoàn.`
            : 'Đơn hàng đã bị hủy trên hệ thống Shopee / SPX (Đang lưu/chuyển kho hoàn)';
        } else {
          rawStatusText = cancelDesc || timeline[0]?.statusText || 'Đơn vị vận chuyển thông báo đơn hàng đã bị hủy';
          statusDetail = 'Đơn hàng đã bị hủy trên hệ thống Shopee / SPX (Cần giữ lại/thu hồi kiện hàng)';
        }
        scannedAt = pickTime;
      } else if (hasReturned) {
        statusCategory = 'returned';
        rawStatusText = timeline[0]?.statusText || 'Chuyển hoàn đơn hàng SPX';
        statusDetail = 'Bưu kiện đang trong quá trình chuyển hoàn lại người gửi';
        scannedAt = pickTime;
      } else if (isDeliveringOrTransit) {
        statusCategory = 'in_transit';
        rawStatusText = timeline[0]?.statusText || 'Đang vận chuyển qua hệ thống SPX';
        statusDetail = 'Bưu kiện đang luân chuyển qua mạng lưới bưu cục/kho SPX SOC';
        scannedAt = pickTime;
      } else if (hasPickedUp) {
        statusCategory = 'scanned';
        rawStatusText = timeline[0]?.statusText || 'Đã lấy hàng - SPX đã nhận kiện';
        statusDetail = 'Tài xế / Bưu tá SPX đã lấy hàng và quét mã thành công';
        scannedAt = pickTime;
      } else if (isPickupFailed) {
        statusCategory = 'not_scanned';
        rawStatusText = timeline[0]?.statusText || 'Lấy hàng không thành công';
        const failReason = records[0]?.reason_desc || records[0]?.seller_description || '';
        statusDetail = failReason 
          ? `Bưu tá SPX lấy hàng không thành công: ${failReason} (Kiện hàng vẫn ở kho/chưa scan lấy)`
          : 'Bưu tá SPX lấy hàng không thành công (Kiện hàng vẫn ở kho/chưa scan lấy)';
        scannedAt = undefined;
      } else {
        statusCategory = 'not_scanned';
        rawStatusText = timeline[0]?.statusText || 'Người bán đang chuẩn bị hàng';
        statusDetail = 'Đơn hàng đã tạo trên Shopee, bưu tá SPX chưa tới lấy kiện';
        scannedAt = undefined;
      }

      let recipientInfo = '';
      if (recipientName) recipientInfo = `Khách: ${recipientName}`;
      if (slsTn) recipientInfo = recipientInfo ? `${recipientInfo} | Mã phụ: ${slsTn}` : `Mã SLS: ${slsTn}`;

      const resultData = {
        carrier: 'spx',
        statusCategory,
        rawStatusText,
        statusDetail,
        updatedAt: timeline[0]?.time,
        scannedAt,
        recipientLocation: recipientInfo || undefined,
        timeline
      };

      setInCache(cacheKey, resultData);
      return {
        success: true,
        data: resultData
      };
    } catch (err: any) {
      if (attempt === 1) {
        return {
          success: false,
          error: err.message || "Lỗi kết nối tới SPX Express"
        };
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    success: false,
    error: "Hệ thống SPX tạm thời bận, vui lòng thử lại"
  };
}

// Ninja Van Live Tracking
async function fetchNinjaVanLive(trackingId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanCode = trackingId.trim().toUpperCase();
  const cacheKey = `ninjavan:${cleanCode}`;
  const cached = getFromCache(cacheKey);
  if (cached) {
    return { success: true, data: cached };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(`https://api.ninjavan.co/vn/dash/1.2/public/orders?tracking_id=${encodeURIComponent(cleanCode)}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Ninja Van API HTTP ${response.status}`
      };
    }

    const json = (await response.json()) as any;
    if (json.orders && json.orders.length > 0) {
      const order = json.orders[0];
      const events = order.events || [];
      const status = order.status || '';
      
      const timeline = events.map((e: any) => ({
        time: formatDate(e.time),
        statusText: e.description || e.status,
        location: e.location || 'Mạng lưới Ninja Van',
        description: ''
      }));

      const isDelivered = status === 'Completed' || status === 'Delivered';
      const isCancelled = status === 'Cancelled';
      const isReturned = status === 'Returned_To_Sender';
      const isTransit = status === 'On_Vehicle_For_Delivery' || status === 'Arrived_At_Sorting_Hub' || status === 'Departed_From_Sorting_Hub';
      const isScanned = status === 'Parcel_Collected' || status === 'Parcel_Received' || events.length > 1;

      let statusCategory = 'not_scanned';
      if (isDelivered) statusCategory = 'delivered';
      else if (isCancelled) statusCategory = 'cancelled';
      else if (isReturned) statusCategory = 'returned';
      else if (isTransit) statusCategory = 'in_transit';
      else if (isScanned) statusCategory = 'scanned';

      const resultData = {
        carrier: 'ninjavan',
        statusCategory,
        rawStatusText: status,
        statusDetail: timeline[0]?.statusText || status,
        scannedAt: events.length > 0 ? formatDate(events[events.length - 1].time) : undefined,
        timeline
      };

      setInCache(cacheKey, resultData);
      return { success: true, data: resultData };
    } else {
      return {
        success: false,
        error: 'Không tìm thấy thông tin đơn hàng trên Ninja Van'
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: 'Lỗi kết nối tới Ninja Van: ' + err.message
    };
  }
}

// ----------------------------------------------------
// VNPost / EMS Integration Service
// ----------------------------------------------------
function mapVNPostStatus(summaryStatus: string, logs: any[] = []) {
  const summary = (summaryStatus || '').toLowerCase();

  // 1. Giao hàng thành công
  if (
    summary.includes('phát thành công') ||
    summary.includes('đã phát') ||
    summary.includes('delivered') ||
    summary.includes('ký nhận')
  ) {
    return {
      category: 'delivered',
      label: summaryStatus || 'Phát hàng thành công',
      isScanned: true
    };
  }

  // 2. Chuyển hoàn / Hoàn hàng
  if (
    summary.includes('chuyển hoàn') ||
    summary.includes('hoàn hàng') ||
    summary.includes('trả lại') ||
    summary.includes('không phát được') ||
    summary.includes('phát không thành công') ||
    summary.includes('hoàn trả') ||
    summary.includes('chờ chuyển hoàn')
  ) {
    return {
      category: 'returned',
      label: summaryStatus || 'Bưu gửi chuyển hoàn',
      isScanned: true
    };
  }

  // 3. Đã hủy
  if (summary.includes('hủy') || summary.includes('huỷ')) {
    return {
      category: 'cancelled',
      label: summaryStatus || 'Đơn hàng đã hủy',
      isScanned: false
    };
  }

  // Kiểm tra lịch sử logs nếu có
  const hasPickupScan = logs.some(l => {
    const t = (l.TRANG_THAI || '').toLowerCase();
    return (
      t.includes('nhận hàng thành công') ||
      t.includes('picked up') ||
      t.includes('chấp nhận gửi') ||
      t.includes('posting') ||
      t.includes('vận chuyển') ||
      t.includes('bưu cục') ||
      t.includes('giao bưu tá phát') ||
      t.includes('phát thành công')
    );
  });

  // 4. Đang giao hàng / Đang vận chuyển
  if (
    summary.includes('đang giao') ||
    summary.includes('đang phát') ||
    summary.includes('giao bưu tá') ||
    summary.includes('out for physical delivery') ||
    summary.includes('vận chuyển') ||
    summary.includes('bưu cục') ||
    summary.includes('trung chuyển') ||
    hasPickupScan
  ) {
    const isOnlyPickedUp = logs.length <= 2 && logs.every(l => {
      const t = (l.TRANG_THAI || '').toLowerCase();
      return t.includes('nhận hàng') || t.includes('chấp nhận') || t.includes('điều tin') || t.includes('phân hướng');
    });

    if (isOnlyPickedUp) {
      return {
        category: 'scanned',
        label: summaryStatus || 'Bưu điện đã nhận hàng',
        isScanned: true
      };
    }

    return {
      category: 'in_transit',
      label: summaryStatus || 'Đang vận chuyển',
      isScanned: true
    };
  }

  // 5. Chưa scan lấy hàng (Điều tin, phân hướng, chờ thu gom)
  return {
    category: 'not_scanned',
    label: summaryStatus || 'Chờ bưu điện lấy hàng',
    isScanned: false
  };
}

// Single VNPost / EMS Live Tracking
async function fetchVNPostLive(orderCode: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanCode = orderCode.trim().toUpperCase();
  const cacheKey = `vnpost:${cleanCode}`;
  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached };
    }
  }

  const itemCode = cleanCode.endsWith('EMS') ? cleanCode : (cleanCode + 'EMS');

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`https://api.myems.vn/TrackAndTraceItemCode?itemcode=${encodeURIComponent(itemCode)}&language=0`, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Origin": "https://ems.com.vn",
          "Referer": "https://ems.com.vn/"
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (attempt === 1) {
          return { success: false, error: `VNPost API HTTP ${res.status}` };
        }
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      const json = (await res.json()) as any;
      if (json && (json.Code === "00" || json.TBL_INFO || (Array.isArray(json.List_TBL_DINH_VI) && json.List_TBL_DINH_VI.length > 0))) {
        const info = json.TBL_INFO || {};
        const dinhViLogs = json.List_TBL_DINH_VI || [];

        const mapped = mapVNPostStatus(info.TRANG_THAI || (dinhViLogs[dinhViLogs.length - 1]?.TRANG_THAI) || '', dinhViLogs);

        let scannedAtTime: string | undefined;
        const pickupLog = dinhViLogs.find((l: any) => {
          const t = (l.TRANG_THAI || '').toLowerCase();
          return t.includes('nhận hàng') || t.includes('chấp nhận') || t.includes('posting') || t.includes('picked up');
        });
        if (pickupLog) {
          scannedAtTime = formatDate(pickupLog.NGAY_TRANG_THAI || `${pickupLog.NGAY} ${pickupLog.GIO}`);
        } else if (mapped.isScanned && dinhViLogs.length > 0) {
          const firstNonDispatch = dinhViLogs.find((l: any) => {
            const t = (l.TRANG_THAI || '').toLowerCase();
            return !t.includes('điều tin') && !t.includes('phân hướng');
          });
          if (firstNonDispatch) {
            scannedAtTime = formatDate(firstNonDispatch.NGAY_TRANG_THAI || `${firstNonDispatch.NGAY} ${firstNonDispatch.GIO}`);
          }
        }

        const timeline = dinhViLogs.slice().reverse().map((l: any) => ({
          time: formatDate(l.NGAY_TRANG_THAI || `${l.NGAY} ${l.GIO}`),
          statusText: l.TRANG_THAI?.replace(/\s+/g, ' ').trim() || '',
          location: l.VI_TRI?.replace(/\s+/g, ' ').trim() || '',
          description: l.DIEN_THOAI ? `Hotline/SĐT: ${l.DIEN_THOAI}` : ''
        }));

        const latestLog = dinhViLogs[dinhViLogs.length - 1];
        const statusDetail = info.TRANG_THAI || latestLog?.TRANG_THAI || 'Bưu gửi VNPost';

        const resultData = {
          carrier: 'vnpost',
          statusCategory: mapped.category,
          rawStatusText: statusDetail,
          statusDetail: latestLog?.VI_TRI ? `${statusDetail} - ${latestLog.VI_TRI.replace(/\s+/g, ' ').trim()}` : statusDetail,
          scannedAt: mapped.isScanned ? (scannedAtTime || formatDate(new Date().toISOString())) : undefined,
          updatedAt: timeline[0]?.time,
          recipientLocation: info.DIA_CHI_NHAN?.replace(/\s+/g, ' ').trim(),
          recipientName: info.HO_TEN_NHAN?.replace(/\s+/g, ' ').trim(),
          senderName: info.HO_TEN_GUI?.replace(/\s+/g, ' ').trim(),
          weight: info.KHOI_LUONG ? `${info.KHOI_LUONG}g` : undefined,
          refCode: info.MA_THAM_CHIEU,
          timeline
        };

        setInCache(cacheKey, resultData);
        return { success: true, data: resultData };
      } else {
        return {
          success: false,
          error: json?.Message || 'Chưa tìm thấy hành trình bưu gửi trên hệ thống VNPost / EMS'
        };
      }
    } catch (err: any) {
      if (attempt === 1) {
        return {
          success: false,
          error: err.message ? `Lỗi kết nối tới VNPost: ${err.message}` : 'Lỗi kết nối cổng VNPost'
        };
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    success: false,
    error: 'Hệ thống VNPost không phản hồi, vui lòng thử lại'
  };
}

// VNPost Batch Tracking
async function fetchVNPostBatchLive(
  trackingCodes: string[],
  force: boolean = false
): Promise<Record<string, { success: boolean; data?: any; error?: string; carrier?: string }>> {
  const cleanCodes = Array.from(new Set(trackingCodes.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  if (cleanCodes.length === 0) return {};

  const results: Record<string, { success: boolean; data?: any; error?: string; carrier?: string }> = {};

  const CONCURRENCY = 10;
  for (let i = 0; i < cleanCodes.length; i += CONCURRENCY) {
    const chunk = cleanCodes.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (code) => {
        results[code] = await fetchVNPostLive(code, force);
      })
    );
    if (i + CONCURRENCY < cleanCodes.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// ----------------------------------------------------
// BEST Express Integration Service
// ----------------------------------------------------

function mapBestStatus(statusTypeCode?: string, rawRemark?: string) {
  const st = (statusTypeCode || '').trim();
  const rm = (rawRemark || '').toLowerCase();

  // 1. Returned / Hoàn hàng
  if (
    st === 'Returnning' ||
    st === 'ReturnedSigned' ||
    rm.includes('hoàn hàng') ||
    rm.includes('chuyển hoàn') ||
    rm.includes('trả hàng') ||
    rm.includes('đang hoàn')
  ) {
    return {
      category: 'returned',
      label: rawRemark || (st === 'ReturnedSigned' ? 'Đã chuyển hoàn thành công' : 'Đang chuyển hoàn'),
      isScanned: true
    };
  }

  // 2. Delivered / Giao thành công
  if (
    st === 'Sign' ||
    rm.includes('đã ký nhận') ||
    rm.includes('giao hàng thành công') ||
    rm.includes('giao thành công') ||
    rm.includes('ký nhận') ||
    rm.includes('phát thành công')
  ) {
    return {
      category: 'delivered',
      label: rawRemark || 'Giao hàng thành công (Đã ký nhận)',
      isScanned: true
    };
  }

  // 3. In transit / Delivering
  if (
    st === 'On the Way' ||
    st === 'Dispatch' ||
    rm.includes('đang giao') ||
    rm.includes('đang phát') ||
    rm.includes('trung chuyển') ||
    rm.includes('xuất bưu cục') ||
    rm.includes('nhập bưu cục') ||
    rm.includes('rời bưu cục') ||
    rm.includes('nhập kho') ||
    rm.includes('xuất kho') ||
    rm.includes('đang vận chuyển')
  ) {
    return {
      category: 'in_transit',
      label: rawRemark || (st === 'Dispatch' ? 'Đang giao hàng' : 'Đang vận chuyển'),
      isScanned: true
    };
  }

  // 4. Scanned / Collected
  if (
    st === 'Collected' ||
    rm.includes('đã lấy hàng') ||
    rm.includes('lấy hàng thành công') ||
    rm.includes('tiếp nhận') ||
    rm.includes('đã nhận hàng') ||
    rm.includes('quét mã tiếp nhận')
  ) {
    return {
      category: 'scanned',
      label: rawRemark || 'Đã lấy hàng & tiếp nhận BEST',
      isScanned: true
    };
  }

  // 5. Not scanned / Created / None
  return {
    category: 'not_scanned',
    label: rawRemark || 'Chờ BEST Express lấy hàng (Chưa scan)',
    isScanned: false
  };
}

// Single BEST Express Live Tracking
async function fetchBestLive(orderCode: string, force: boolean = false): Promise<{ success: boolean; data?: any; error?: string; carrier?: string }> {
  const cleanCode = (orderCode || '').trim().toUpperCase();
  const cacheKey = `best:${cleanCode}`;
  if (!force) {
    const cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, carrier: 'best' };
    }
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch('https://best-inc.vn/express-cc/express/expresslistinfo', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'X-Lan': 'VI',
          'lang-type': 'vi-VN',
          'X-Auth-Type': 'WEB',
          'X-Nat': 'vi-VN',
          'X-Timezone-Offset': '-420',
          'Origin': 'https://best-inc.vn',
          'Referer': 'https://best-inc.vn/track',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        },
        body: JSON.stringify({
          expressIds: [cleanCode]
        })
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (attempt === 1) {
          return { success: false, error: `BEST API HTTP ${res.status}`, carrier: 'best' };
        }
        await new Promise(r => setTimeout(r, 300));
        continue;
      }

      const json = (await res.json()) as any;

      // 1. Success response with data
      if (json && json.success && json.data?.expressList && json.data.expressList.length > 0) {
        const item = json.data.expressList[0];
        const currentScanTypeCode = item.currentScanTypeCode || 'None';
        const rawTraces = Array.isArray(item.traceDetails) ? item.traceDetails : [];

        const timeline = rawTraces.map((t: any) => ({
          time: t.acceptTime || '',
          statusText: t.scanTypeCode || currentScanTypeCode,
          description: (t.remark || '') + (t.sitePhone ? ` (SĐT trạm: ${t.sitePhone})` : '')
        }));

        const latestRemark = rawTraces[0]?.remark || '';
        const mapped = mapBestStatus(currentScanTypeCode, latestRemark);

        // Find pickup scan time
        let scannedAt: string | undefined = undefined;
        for (const t of rawTraces) {
          const rm = (t.remark || '').toLowerCase();
          if (
            t.scanTypeCode === 'Collected' ||
            rm.includes('đã lấy') ||
            rm.includes('lấy hàng thành công') ||
            rm.includes('tiếp nhận')
          ) {
            scannedAt = t.acceptTime;
            break;
          }
        }
        if (!scannedAt && (mapped.category === 'in_transit' || mapped.category === 'delivered' || mapped.category === 'returned' || mapped.category === 'scanned')) {
          scannedAt = rawTraces[rawTraces.length - 1]?.acceptTime || rawTraces[0]?.acceptTime;
        }

        const data = {
          carrier: 'best',
          statusCategory: mapped.category,
          rawStatusText: mapped.label,
          statusDetail: latestRemark,
          scannedAt,
          updatedAt: rawTraces[0]?.acceptTime,
          timeline,
          trackUrl: `https://best-inc.vn/track?bills=${encodeURIComponent(cleanCode)}`
        };

        setInCache(cacheKey, data);
        return { success: true, data, carrier: 'best' };
      }

      // 2. Risk / Captcha verification required
      if (json && json.errorCode === 'risk_001') {
        const data = {
          carrier: 'best',
          statusCategory: 'not_scanned',
          rawStatusText: 'Chờ BEST Express lấy hàng (Chưa scan)',
          statusDetail: 'Đơn mới tạo WMS • Hãng bảo mật Captcha (bấm để xem trực tiếp)',
          trackUrl: `https://best-inc.vn/track?bills=${encodeURIComponent(cleanCode)}`,
          scannedAt: undefined,
          timeline: []
        };
        // Short cache TTL for captcha required (3 minutes)
        setInCache(cacheKey, data, 180 * 1000);
        return { success: true, data, carrier: 'best' };
      }

      // 3. Not found or other response
      const data = {
        carrier: 'best',
        statusCategory: 'not_scanned',
        rawStatusText: 'Chờ BEST Express lấy hàng (Chưa scan)',
        statusDetail: json?.message || 'Mã vận đơn đã tạo trên hệ thống, đang chờ cập nhật trạng thái',
        trackUrl: `https://best-inc.vn/track?bills=${encodeURIComponent(cleanCode)}`,
        scannedAt: undefined,
        timeline: []
      };
      setInCache(cacheKey, data, 60 * 1000);
      return { success: true, data, carrier: 'best' };

    } catch (err: any) {
      if (attempt === 1) {
        return {
          success: true,
          data: {
            carrier: 'best',
            statusCategory: 'not_scanned',
            rawStatusText: 'Chờ BEST Express lấy hàng (Chưa scan)',
            statusDetail: 'Đang kết nối với cổng BEST Express...',
            trackUrl: `https://best-inc.vn/track?bills=${encodeURIComponent(cleanCode)}`,
            scannedAt: undefined,
            timeline: []
          },
          carrier: 'best'
        };
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  return {
    success: false,
    error: 'Không thể kết nối cổng BEST Express',
    carrier: 'best'
  };
}

// BEST Express Batch Tracking
async function fetchBestBatchLive(
  trackingCodes: string[],
  force: boolean = false
): Promise<Record<string, { success: boolean; data?: any; error?: string; carrier?: string }>> {
  const cleanCodes = Array.from(new Set(trackingCodes.map(c => (c || '').trim().toUpperCase()).filter(Boolean)));
  if (cleanCodes.length === 0) return {};

  const results: Record<string, { success: boolean; data?: any; error?: string; carrier?: string }> = {};

  const CONCURRENCY = 10;
  for (let i = 0; i < cleanCodes.length; i += CONCURRENCY) {
    const chunk = cleanCodes.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (code) => {
        results[code] = await fetchBestLive(code, force);
      })
    );
    if (i + CONCURRENCY < cleanCodes.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// ----------------------------------------------------
// YunWMS (WMS Cloud) Integration Service
// ----------------------------------------------------
let yunWMSSessionCookie: string | null = null;
let yunWMSSessionExpiry: number = 0;
let yunWMSLoginPromise: Promise<string> | null = null;

const WMS_STATUS_MAP: Record<string, string> = {
  '0': 'Đã xóa',
  '1': 'Bản nháp',
  '2': 'Đã xác nhận',
  '3': 'Bất thường',
  '4': 'Đã nộp (Chờ xử lý)',
  '5': 'Đã hạ kệ',
  '6': 'Hoàn thành hạ kệ',
  '7': 'Đã dán nhãn',
  '78': 'Đã đối soát',
  '8': 'Đã xuất kho',
  '14': 'Đã cắt đơn'
};

function extractCookiesFromHeaders(headers: any): Record<string, string> {
  const cookiesMap: Record<string, string> = {};
  let setCookies: string[] = [];

  if (typeof headers.getSetCookie === 'function') {
    setCookies = headers.getSetCookie();
  } else if (typeof headers.raw === 'function') {
    setCookies = headers.raw()['set-cookie'] || [];
  } else if (typeof headers.get === 'function') {
    const headerVal = headers.get('set-cookie');
    if (headerVal) {
      setCookies = headerVal.split(/,(?=\s*[a-zA-Z0-9_\-]+=)/);
    }
  }

  for (const c of setCookies) {
    if (!c) continue;
    const cookiePart = c.split(';')[0];
    const eqIdx = cookiePart.indexOf('=');
    if (eqIdx !== -1) {
      const name = cookiePart.substring(0, eqIdx).trim();
      const val = cookiePart.substring(eqIdx + 1).trim();
      cookiesMap[name] = val;
    }
  }
  return cookiesMap;
}

const WMS_WAREHOUSE_MAP: Record<string, string> = {
  '7': 'VN02 [Kho Hồ Chí Minh]',
  '4': 'VN01 [Kho VN01 Hải Ngoại]'
};

async function getYunWMSCookie(userName: string = 'David', userPass: string = '12345abc', forceNew: boolean = false): Promise<string> {
  if (!forceNew && yunWMSSessionCookie && Date.now() < yunWMSSessionExpiry) {
    return yunWMSSessionCookie;
  }

  if (yunWMSLoginPromise) {
    return yunWMSLoginPromise;
  }

  yunWMSLoginPromise = (async () => {
    try {
      const baseUrl = 'https://czwh.wms.yunwms.com';
      const initRes = await fetch(baseUrl + '/', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const cookiesMap = extractCookiesFromHeaders(initRes.headers);

      const body = new URLSearchParams();
      body.append('userName', userName);
      body.append('userPass', Buffer.from(userPass).toString('base64'));

      const cookieStr = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');
      const loginRes = await fetch(baseUrl + '/login.html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': baseUrl + '/'
        },
        body: body.toString()
      });

      const loginJson: any = await loginRes.json();
      if (!loginJson.state) {
        throw new Error(loginJson.message || 'Đăng nhập YunWMS không thành công. Vui lòng kiểm tra tài khoản/mật khẩu.');
      }

      const loginCookies = extractCookiesFromHeaders(loginRes.headers);
      Object.assign(cookiesMap, loginCookies);

      yunWMSSessionCookie = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');
      yunWMSSessionExpiry = Date.now() + 1800000; // 30 mins session validity
      return yunWMSSessionCookie;
    } finally {
      yunWMSLoginPromise = null;
    }
  })();

  return yunWMSLoginPromise;
}

export function computeYunWMSDateRange(
  dateInterval?: string,
  customDateFor?: string,
  customDateTo?: string,
  searchDateType: string = 'createDate',
  excludeToday: boolean = false
): { dateFor: string; dateTo: string; searchDateType: string } | null {
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr = vnFormatter.format(now);
  const oneDayMs = 24 * 60 * 60 * 1000;
  const yesterdayStr = vnFormatter.format(new Date(now.getTime() - oneDayMs));

  if (customDateFor && customDateTo) {
    let finalTo = customDateTo.trim();
    if (excludeToday && finalTo >= todayStr) {
      finalTo = yesterdayStr;
    }
    return {
      dateFor: customDateFor.trim(),
      dateTo: finalTo,
      searchDateType: searchDateType || 'createDate'
    };
  }

  if (excludeToday) {
    // Exclude today: dateTo is always yesterdayStr (shipper -1 ngày)
    if (!dateInterval || dateInterval === 'all' || dateInterval === '0') {
      return {
        dateFor: '2020-01-01',
        dateTo: yesterdayStr,
        searchDateType: searchDateType || 'createDate'
      };
    }

    const days = parseInt(dateInterval, 10);
    if (isNaN(days) || days <= 0) {
      return {
        dateFor: '2020-01-01',
        dateTo: yesterdayStr,
        searchDateType: searchDateType || 'createDate'
      };
    }

    // Interval ending yesterday
    const pastMs = now.getTime() - (days * oneDayMs);
    const fromStr = vnFormatter.format(new Date(pastMs));
    return {
      dateFor: fromStr,
      dateTo: yesterdayStr,
      searchDateType: searchDateType || 'createDate'
    };
  }

  if (!dateInterval || dateInterval === 'all' || dateInterval === '0') {
    return null; // All orders
  }

  const days = parseInt(dateInterval, 10);
  if (isNaN(days) || days <= 0) {
    return null;
  }

  const pastMs = now.getTime() - (days - 1) * oneDayMs;
  const fromStr = vnFormatter.format(new Date(pastMs));

  return {
    dateFor: fromStr,
    dateTo: todayStr,
    searchDateType: searchDateType || 'createDate'
  };
}

async function fetchYunWMSOrdersList({
  userName = 'David',
  userPass = '12345abc',
  page = 1,
  pageSize = 50,
  dateInterval = '3',
  dateFor = '',
  dateTo = '',
  searchDateType = 'createDate',
  customerCode = '',
  orderStatus = '',
  warehouseId = '7', // Default to 7: VN02 [越南胡志明仓库]
  searchCode = '',
  only8623AndSpxvn = false,
  excludeToday = false,
  carrierFilterMode = '',
  selectedCarriers = [],
  customPrefixes = []
}: {
  userName?: string;
  userPass?: string;
  page?: number;
  pageSize?: number;
  dateInterval?: string;
  dateFor?: string;
  dateTo?: string;
  searchDateType?: string;
  customerCode?: string;
  orderStatus?: string;
  warehouseId?: string;
  searchCode?: string;
  only8623AndSpxvn?: boolean;
  excludeToday?: boolean;
  carrierFilterMode?: string;
  selectedCarriers?: string[];
  customPrefixes?: string[];
}) {
  let cookie = await getYunWMSCookie(userName, userPass);
  const baseUrl = 'https://czwh.wms.yunwms.com';

  const postData = new URLSearchParams();
  const dateRange = computeYunWMSDateRange(dateInterval, dateFor, dateTo, searchDateType, excludeToday);
  if (dateRange) {
    postData.append('searchDateType', dateRange.searchDateType);
    postData.append('dateFor', dateRange.dateFor);
    postData.append('dateTo', dateRange.dateTo);
  } else {
    postData.append('date_interval', '');
  }

  if (customerCode) postData.append('E3', customerCode);
  if (orderStatus) postData.append('E11', orderStatus);
  if (warehouseId) postData.append('E4', warehouseId);
  if (searchCode) postData.append('searchCode', searchCode);

  let ordersRes = await fetch(`${baseUrl}/order/orders/list/page/${page}/pageSize/${pageSize}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Cookie': cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${baseUrl}/order/orders/list`
    },
    body: postData.toString()
  });

  let json = await ordersRes.json();
  if (!json || json.state !== 1) {
    cookie = await getYunWMSCookie(userName, userPass, true);
    ordersRes = await fetch(`${baseUrl}/order/orders/list/page/${page}/pageSize/${pageSize}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${baseUrl}/order/orders/list`
      },
      body: postData.toString()
    });
    json = await ordersRes.json();
  }

  // Get current date string in VN GMT+7 for strict filtering
  const now = new Date();
  const vnFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const todayStr4 = vnFormatter.format(now); // e.g. "2026-09-08"
  const todayStr2 = todayStr4.substring(2);  // e.g. "26-09-08"

  const rawList = Array.isArray(json.data) ? json.data : [];
  const rawCount = rawList.length;

  const normalized = rawList.map((item: any) => {
    const rawTrackNo = (item.tracking_number || '').trim();
    const wmsStatusCode = String(item.E11 || '');
    const wmsWarehouseId = String(item.E4 || warehouseId || '');
    return {
      orderNo: item.E1 || '',
      refNo: item.E17 || '',
      trackingNumber: rawTrackNo,
      platformOrderNo: item.refrence_no_platforms || item.E1 || '',
      customerCode: item.E3 || '',
      warehouseId: wmsWarehouseId,
      warehouseName: WMS_WAREHOUSE_MAP[wmsWarehouseId] || (wmsWarehouseId === '7' ? 'VN02 [Kho Hồ Chí Minh]' : wmsWarehouseId === '4' ? 'VN01 [Kho VN01 Hải Ngoại]' : `Kho ${wmsWarehouseId}`),
      carrierChannel: item.E7 || item.E32 || '',
      recipientName: item.oab_firstname || '',
      wmsStatus: WMS_STATUS_MAP[wmsStatusCode] || `Trạng thái ${wmsStatusCode}`,
      wmsStatusCode,
      createDate: item.warehouse_E14 || item.E14 || '',
      productsCount: Array.isArray(item.productList) ? item.productList.length : 1,
      buyersMessage: item.buyers_message || '',
      country: item.E23 || 'VN'
    };
  }).filter((order: any) => {
    // 1. Filter: Kiểm tra đầu mã vận đơn theo cấu hình người dùng
    const track = (order.trackingNumber || '').trim().toUpperCase();
    const effectiveMode = (carrierFilterMode as any) || (only8623AndSpxvn ? 'spx_jt' : 'all');
    const isMatchedPrefix = matchesTrackingPrefixFilter(track, {
      carrierFilterMode: effectiveMode,
      selectedCarriers,
      customPrefixes,
      only8623AndSpxvn
    });
    if (!isMatchedPrefix) {
      return false;
    }

    // 2. Filter: Loại trừ đơn hôm nay (chỉ kéo từ hôm qua trở về quá khứ)
    if (excludeToday) {
      const orderDate = (order.createDate || '').trim();
      if (orderDate.startsWith(todayStr4) || orderDate.startsWith(todayStr2)) {
        return false;
      }
    }

    return true;
  });

  const rawTotal = json.total ?? json.totalCount ?? json.recordsTotal ?? json.records ?? json.count ?? json.data_count ?? (json.pagination && json.pagination.total);
  const parsedTotal = Number(rawTotal);
  const finalTotal = (!isNaN(parsedTotal) && parsedTotal > 0) ? parsedTotal : 0;

  return {
    total: finalTotal,
    page,
    pageSize,
    warehouseId,
    rawCount,
    hasMore: rawCount >= pageSize,
    orders: normalized
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 5000;

  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "150mb", extended: true }));

  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Initialize SQLite database
  await initSqliteDb();

  // In-memory RAM Cache for high-speed serving (1-5ms response instead of 13s DB queries)
  let cachedOrdersPayload: string | null = null;
  let cachedOrdersGzip: Buffer | null = null;
  let cachedOrdersTimestamp: number = 0;
  let cachedOrdersStats: any = null;
  const ORDERS_CACHE_TTL = 60000; // 60s cache TTL

  const invalidateOrdersCache = () => {
    cachedOrdersPayload = null;
    cachedOrdersGzip = null;
    cachedOrdersTimestamp = 0;
    cachedOrdersStats = null;
  };

  // Get orders from SQLite (Instant RAM Cache + GZIP, zero DB query bottleneck)
  const handleGetOrders = async (req: express.Request, res: express.Response) => {
    try {
      const now = Date.now();
      if (!cachedOrdersGzip || (now - cachedOrdersTimestamp > ORDERS_CACHE_TTL)) {
        const orders = await getAllSqliteOrders();
        const stats = await getSqliteStats();
        cachedOrdersStats = stats;
        const payloadString = JSON.stringify({
          success: true,
          orders,
          count: orders.length,
          stats,
          lastSaved: new Date().toISOString()
        });

        cachedOrdersPayload = payloadString;
        cachedOrdersGzip = zlib.gzipSync(payloadString);
        cachedOrdersTimestamp = now;
      }

      const acceptEncoding = (req.headers["accept-encoding"] || "") as string;
      if (acceptEncoding.includes("gzip") && cachedOrdersGzip) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Encoding", "gzip");
        res.setHeader("Vary", "Accept-Encoding");
        res.setHeader("Cache-Control", "public, max-age=10");
        return res.send(cachedOrdersGzip);
      }

      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.send(cachedOrdersPayload);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.get("/api/orders", handleGetOrders);
  app.get("/api/orders/state", handleGetOrders);

  // Lazy-load timeline for single tracking code
  app.get("/api/orders/:code/timeline", async (req: express.Request, res: express.Response) => {
    try {
      const code = req.params.code;
      if (!code) {
        return res.status(400).json({ success: false, error: "Missing tracking code" });
      }
      const timeline = await getOrderTimeline(code);
      return res.json({
        success: true,
        trackingCode: code,
        timeline: timeline || []
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Fast stats endpoint (using RAM cache if valid)
  app.get("/api/orders/stats", async (req, res) => {
    try {
      if (cachedOrdersStats && (Date.now() - cachedOrdersTimestamp <= ORDERS_CACHE_TTL)) {
        return res.json({ success: true, stats: cachedOrdersStats });
      }
      const stats = await getSqliteStats();
      cachedOrdersStats = stats;
      return res.json({ success: true, stats });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Batch UPSERT orders into SQLite (Atomically update/overwrite in milliseconds)
  const handleUpsertOrders = async (req: express.Request, res: express.Response) => {
    try {
      const { orders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ success: false, error: "orders must be an array" });
      }
      const updatedCount = await upsertSqliteOrders(orders);
      invalidateOrdersCache();
      const stats = await getSqliteStats();
      return res.json({
        success: true,
        count: orders.length,
        updated: updatedCount,
        stats,
        lastSaved: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post("/api/orders", handleUpsertOrders);
  app.post("/api/orders/upsert", handleUpsertOrders);
  app.post("/api/orders/state", handleUpsertOrders);

  // Clear orders from SQLite
  const handleClearOrders = async (req: express.Request, res: express.Response) => {
    try {
      await clearSqliteOrders();
      invalidateOrdersCache();
      const legacyState = path.join(process.cwd(), "data", "orders_state.json");
      if (fs.existsSync(legacyState)) {
        try { fs.unlinkSync(legacyState); } catch {}
      }
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  };

  app.delete("/api/orders", handleClearOrders);
  app.delete("/api/orders/state", handleClearOrders);

  // YunWMS Test Auth endpoint
  app.post("/api/yunwms/test-auth", async (req, res) => {
    try {
      const { userName = "David", userPass = "12345abc" } = req.body;
      const cookie = await getYunWMSCookie(userName, userPass, true);
      res.json({ success: true, message: "Đăng nhập YunWMS thành công!", hasSession: !!cookie });
    } catch (err: any) {
      res.status(401).json({ success: false, error: err.message || "Lỗi đăng nhập YunWMS" });
    }
  });

  // YunWMS Fetch Orders endpoint
  app.post("/api/yunwms/orders", async (req, res) => {
    try {
      const {
        userName = "David",
        userPass = "12345abc",
        page = 1,
        pageSize = 50,
        dateInterval = "3",
        dateFor = "",
        dateTo = "",
        customerCode = "",
        orderStatus = "",
        warehouseId = "7",
        searchCode = "",
        only8623AndSpxvn = true,
        excludeToday = true,
        carrierFilterMode = "",
        selectedCarriers = [],
        customPrefixes = []
      } = req.body;

      const result = await fetchYunWMSOrdersList({
        userName,
        userPass,
        page: Number(page) || 1,
        pageSize: Number(pageSize) || 50,
        dateInterval,
        dateFor,
        dateTo,
        customerCode,
        orderStatus,
        warehouseId: req.body.E4 !== undefined ? req.body.E4 : warehouseId,
        searchCode,
        only8623AndSpxvn: Boolean(only8623AndSpxvn),
        excludeToday: Boolean(excludeToday),
        carrierFilterMode: String(carrierFilterMode || ''),
        selectedCarriers: Array.isArray(selectedCarriers) ? selectedCarriers : [],
        customPrefixes: Array.isArray(customPrefixes) ? customPrefixes : []
      });

      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Lỗi khi lấy dữ liệu đơn từ YunWMS" });
    }
  });

  // YunWMS Bulk Sync endpoint (Fetch all pages for chosen date interval)
  app.post("/api/yunwms/sync", async (req, res) => {
    try {
      const {
        userName = "David",
        userPass = "12345abc",
        limit = 0,
        dateInterval = "7",
        dateFor = "",
        dateTo = "",
        customerCode = "",
        orderStatus = "",
        warehouseId = "7",
        searchCode = "",
        only8623AndSpxvn = true,
        excludeToday = true,
        carrierFilterMode = "",
        selectedCarriers = [],
        customPrefixes = []
      } = req.body;

      const parsedLimit = Number(limit);
      const isUnlimited = parsedLimit <= 0;
      const targetLimit = isUnlimited ? 200000 : parsedLimit;
      const pageSize = 100;
      let allOrders: any[] = [];
      let totalWmsOrders = 0;
      const effectiveWarehouseId = req.body.E4 !== undefined ? req.body.E4 : warehouseId;

      for (let p = 1; ; p++) {
        const fetchSize = (!isUnlimited && targetLimit - allOrders.length < pageSize) 
          ? Math.max(1, targetLimit - allOrders.length) 
          : pageSize;

        const pageResult = await fetchYunWMSOrdersList({
          userName,
          userPass,
          page: p,
          pageSize: fetchSize,
          dateInterval,
          dateFor,
          dateTo,
          customerCode,
          orderStatus,
          warehouseId: effectiveWarehouseId,
          searchCode,
          only8623AndSpxvn: Boolean(only8623AndSpxvn),
          excludeToday: Boolean(excludeToday),
          carrierFilterMode: String(carrierFilterMode || ''),
          selectedCarriers: Array.isArray(selectedCarriers) ? selectedCarriers : [],
          customPrefixes: Array.isArray(customPrefixes) ? customPrefixes : []
        });

        totalWmsOrders = pageResult.total || totalWmsOrders;
        if (pageResult.orders && pageResult.orders.length > 0) {
          allOrders = allOrders.concat(pageResult.orders);
        }

        // If WMS returned fewer raw items than fetchSize or rawCount === 0, WMS reached end of data
        if (!pageResult.rawCount || pageResult.rawCount < fetchSize) {
          break;
        }

        if (!isUnlimited && allOrders.length >= targetLimit) {
          allOrders = allOrders.slice(0, targetLimit);
          break;
        }

        if (totalWmsOrders > 0 && p * pageSize >= totalWmsOrders) {
          break;
        }
      }

      res.json({
        success: true,
        totalWmsOrders,
        syncedCount: allOrders.length,
        warehouseId: effectiveWarehouseId,
        warehouseName: WMS_WAREHOUSE_MAP[effectiveWarehouseId] || (effectiveWarehouseId === '7' ? 'VN02 [Kho Hồ Chí Minh]' : effectiveWarehouseId === '4' ? 'VN01 [Kho VN01 Hải Ngoại]' : 'Tất cả kho'),
        orders: allOrders
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || "Lỗi khi đồng bộ đơn từ YunWMS" });
    }
  });

  // High-Speed Multi-Threaded SSE Sync Stream for YunWMS
  app.post("/api/yunwms/sync-stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const sendSSE = (payload: any) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    let isClosed = false;
    res.on("close", () => {
      if (!res.writableEnded) {
        isClosed = true;
      }
    });

    try {
      const {
        userName = "David",
        userPass = "12345abc",
        limit = 0,
        dateInterval = "7",
        dateFor = "",
        dateTo = "",
        customerCode = "",
        orderStatus = "",
        warehouseId = "7",
        searchCode = "",
        concurrency = 20,
        pageSize = 100,
        only8623AndSpxvn = true,
        excludeToday = true,
        carrierFilterMode = "",
        selectedCarriers = [],
        customPrefixes = []
      } = req.body;

      const effectiveWarehouseId = req.body.E4 !== undefined ? req.body.E4 : warehouseId;
      const parsedLimit = Number(limit);
      const isUnlimited = parsedLimit <= 0;
      const effectiveThreads = Math.max(2, Math.min(30, Number(concurrency) || 20));
      const effectivePageSize = Math.max(50, Math.min(200, Number(pageSize) || 100));

      // 1. Initial probe: fetch Page 1 to inspect data & start batch
      const page1 = await fetchYunWMSOrdersList({
        userName,
        userPass,
        page: 1,
        pageSize: effectivePageSize,
        dateInterval,
        dateFor,
        dateTo,
        customerCode,
        orderStatus,
        warehouseId: effectiveWarehouseId,
        searchCode,
        only8623AndSpxvn: Boolean(only8623AndSpxvn),
        excludeToday: Boolean(excludeToday),
        carrierFilterMode: String(carrierFilterMode || ''),
        selectedCarriers: Array.isArray(selectedCarriers) ? selectedCarriers : [],
        customPrefixes: Array.isArray(customPrefixes) ? customPrefixes : []
      });

      const reportedTotal = page1.total || 0;
      const targetCount = isUnlimited ? (reportedTotal > 0 ? reportedTotal : 0) : Math.min(parsedLimit, reportedTotal > 0 ? reportedTotal : parsedLimit);
      let loadedCount = page1.orders.length;

      sendSSE({
        type: "init",
        totalWmsOrders: reportedTotal || (page1.rawCount === effectivePageSize ? 999999 : loadedCount),
        targetCount: targetCount || (reportedTotal > 0 ? reportedTotal : (page1.rawCount === effectivePageSize ? 999999 : loadedCount)),
        pageSize: effectivePageSize,
        concurrency: effectiveThreads,
        orders: page1.orders,
        loaded: loadedCount,
        progress: targetCount > 0 ? Math.min(100, Math.round((loadedCount / targetCount) * 100)) : (page1.rawCount < effectivePageSize ? 100 : 1),
        warehouseName: WMS_WAREHOUSE_MAP[effectiveWarehouseId] || `Kho ${effectiveWarehouseId}`
      });

      // Stop after page 1 ONLY if YunWMS itself has no more records (rawCount < effectivePageSize),
      // or if user had an explicit limit and we already met it.
      // (NEVER stop just because filtered orders count is less than pageSize!)
      const wmsHasMorePages = page1.rawCount >= effectivePageSize && (reportedTotal === 0 || reportedTotal > effectivePageSize);
      const limitReached = !isUnlimited && targetCount > 0 && loadedCount >= targetCount;

      if (!wmsHasMorePages || limitReached) {
        sendSSE({ type: "done", totalLoaded: loadedCount });
        res.end();
        return;
      }

      // 2. Dynamic Concurrent Multi-Threading Engine for Subsequent Pages
      let nextPageNumber = 2;
      let hasReachedEnd = false;
      const totalWmsPages = reportedTotal > 0 ? Math.ceil(reportedTotal / effectivePageSize) : 5000;
      const maxPagesAllowed = totalWmsPages;

      const runWorker = async (workerId: number) => {
        while (!hasReachedEnd && !isClosed) {
          if (!isUnlimited && targetCount > 0 && loadedCount >= targetCount) {
            hasReachedEnd = true;
            break;
          }

          const currentPage = nextPageNumber++;
          if (currentPage > maxPagesAllowed) {
            hasReachedEnd = true;
            break;
          }

          let pageData: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            if (isClosed || hasReachedEnd) break;
            try {
              pageData = await fetchYunWMSOrdersList({
                userName,
                userPass,
                page: currentPage,
                pageSize: effectivePageSize,
                dateInterval,
                dateFor,
                dateTo,
                customerCode,
                orderStatus,
                warehouseId: effectiveWarehouseId,
                searchCode,
                only8623AndSpxvn: Boolean(only8623AndSpxvn),
                excludeToday: Boolean(excludeToday),
                carrierFilterMode: String(carrierFilterMode || ''),
                selectedCarriers: Array.isArray(selectedCarriers) ? selectedCarriers : [],
                customPrefixes: Array.isArray(customPrefixes) ? customPrefixes : []
              });
              if (pageData && Array.isArray(pageData.orders)) {
                break;
              }
            } catch (err: any) {
              if (attempt === 2) {
                console.error(`Worker ${workerId} failed page ${currentPage}:`, err?.message || err);
              } else {
                await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
              }
            }
          }

          if (isClosed) break;

          // If WMS returned no raw data or 0 items, WMS has no more pages
          if (!pageData || !pageData.rawCount || pageData.rawCount === 0) {
            hasReachedEnd = true;
            break;
          }

          // If WMS returned fewer raw items than effectivePageSize, this is the last page
          if (pageData.rawCount < effectivePageSize) {
            hasReachedEnd = true;
          }

          // Accumulate filtered orders if any exist on this page (do NOT abort if 0 matching orders on this page!)
          if (Array.isArray(pageData.orders) && pageData.orders.length > 0) {
            loadedCount += pageData.orders.length;
          }

          const displayTarget = (!isUnlimited && targetCount > 0) ? targetCount : (reportedTotal > 0 ? reportedTotal : loadedCount);
          const progress = maxPagesAllowed > 0 ? Math.min(100, Math.round((currentPage / maxPagesAllowed) * 100)) : 100;

          sendSSE({
            type: "chunk",
            page: currentPage,
            workerId,
            orders: pageData.orders || [],
            loaded: loadedCount,
            targetCount: displayTarget,
            progress
          });

          if (!isUnlimited && targetCount > 0 && loadedCount >= targetCount) {
            hasReachedEnd = true;
            break;
          }
        }
      };

      const activeConcurrency = Math.min(effectiveThreads, 30);
      const workers = Array.from({ length: activeConcurrency }, (_, idx) => runWorker(idx + 1));
      await Promise.all(workers);

      if (!isClosed) {
        sendSSE({ type: "done", totalLoaded: loadedCount });
        res.end();
      }
    } catch (err: any) {
      if (!isClosed) {
        sendSSE({ type: "error", error: err.message || "Lỗi trong quá trình kéo đa luồng YunWMS" });
        res.end();
      }
    }
  });

  // Single track GHN endpoint
  app.post("/api/track/ghn", async (req, res) => {
    const { orderCode, cellphone } = req.body;
    if (!orderCode) {
      res.status(400).json({ success: false, error: "Missing orderCode" });
      return;
    }
    const result = await fetchGHNLive(orderCode, cellphone);
    res.json(result);
  });

  // Track J&T Express endpoint (auto-routes 530* Cargo codes to Cargo API)
  app.post("/api/track/jnt", async (req, res) => {
    const { billCode, billCodes, cellphone, force } = req.body;
    const rawCodes = billCodes || (typeof billCode === 'string' && billCode.includes(',') ? billCode.split(',') : [billCode]);
    const codes = (Array.isArray(rawCodes) ? rawCodes : [rawCodes]).map((c: any) => String(c).trim()).filter(Boolean);
    if (codes.length === 0) {
      res.status(400).json({ success: false, error: "Missing billCode or billCodes" });
      return;
    }
    const isForce = Boolean(force);
    // Separate Cargo codes (530*) from Express codes
    const cargoCodes = codes.filter((c: string) => /^530\d+$/.test(c) || /^53\d{9,11}$/.test(c));
    const expressCodes = codes.filter((c: string) => !cargoCodes.includes(c));

    if (cargoCodes.length > 0 && expressCodes.length === 0) {
      // All cargo codes
      if (cargoCodes.length === 1) {
        const result = await fetchJNTCargoLive(cargoCodes[0], isForce);
        res.json(result);
      } else {
        const results = await fetchJNTCargoBatchLive(cargoCodes, isForce);
        res.json({ success: true, results });
      }
    } else if (expressCodes.length > 0 && cargoCodes.length === 0) {
      // All express codes
      if (expressCodes.length === 1 && (!billCodes || billCodes.length === 1)) {
        const result = await fetchJNTLive(expressCodes[0], cellphone);
        res.json(result);
      } else {
        const results = await fetchJNTBatchLive(expressCodes, cellphone, isForce);
        res.json({ success: true, results });
      }
    } else {
      // Mixed: cargo + express
      const [cargoResults, expressResults] = await Promise.all([
        fetchJNTCargoBatchLive(cargoCodes, isForce),
        fetchJNTBatchLive(expressCodes, cellphone, isForce)
      ]);
      res.json({ success: true, results: { ...cargoResults, ...expressResults } });
    }
  });

  // Dedicated J&T Cargo tracking endpoint
  app.post("/api/track/jnt-cargo", async (req, res) => {
    const { billCode, billCodes, force } = req.body;
    const rawCodes = billCodes || (typeof billCode === 'string' && billCode.includes(',') ? billCode.split(',') : [billCode]);
    const codes = (Array.isArray(rawCodes) ? rawCodes : [rawCodes]).map((c: any) => String(c).trim()).filter(Boolean);
    if (codes.length === 0) {
      res.status(400).json({ success: false, error: "Missing billCode or billCodes" });
      return;
    }
    const isForce = Boolean(force);
    if (codes.length === 1 && (!billCodes || billCodes.length === 1)) {
      const result = await fetchJNTCargoLive(codes[0], isForce);
      res.json(result);
    } else {
      const results = await fetchJNTCargoBatchLive(codes, isForce);
      res.json({ success: true, results });
    }
  });

  // Single track SPX endpoint
  app.post("/api/track/spx", async (req, res) => {
    const { orderCode, force } = req.body;
    if (!orderCode) {
      res.status(400).json({ success: false, error: "Missing orderCode" });
      return;
    }
    const result = await fetchSPXLive(orderCode, Boolean(force));
    res.json(result);
  });

  // Single track Ninja Van endpoint
  app.post("/api/track/ninjavan", async (req, res) => {
    const { trackingId } = req.body;
    if (!trackingId) {
      res.status(400).json({ success: false, error: "Missing trackingId" });
      return;
    }
    const result = await fetchNinjaVanLive(trackingId);
    res.json(result);
  });

  // Single track VNPost / EMS endpoint
  app.post("/api/track/vnpost", async (req, res) => {
    const { orderCode, force } = req.body;
    if (!orderCode) {
      res.status(400).json({ success: false, error: "Missing orderCode" });
      return;
    }
    const result = await fetchVNPostLive(orderCode, Boolean(force));
    res.json(result);
  });

  // Single track Best Express endpoint
  app.post("/api/track/best", async (req, res) => {
    const { orderCode, force } = req.body;
    if (!orderCode) {
      res.status(400).json({ success: false, error: "Missing orderCode" });
      return;
    }
    const result = await fetchBestLive(orderCode, Boolean(force));
    res.json(result);
  });

  // Clear tracking liveCache endpoint
  app.post("/api/track/clear-cache", (req, res) => {
    liveCache.clear();
    invalidateOrdersCache();
    res.json({ success: true, message: "Cleared live logistics cache and orders RAM cache" });
  });

  // Batch track endpoint (groups J&T in chunks of 10 for native multi-tracking, other carriers concurrent)
  app.post("/api/track/batch", async (req, res) => {
    const { orders, force } = req.body;
    if (!Array.isArray(orders)) {
      res.status(400).json({ success: false, error: "Invalid orders array" });
      return;
    }

    const isGlobalForce = Boolean(force);
    const results: Record<string, any> = {};

    // 1. Properly resolve carrier based on tracking code format first (prevents mislabelled J&T notes from breaking SPX/GHN/VNPost/BEST)
    const jtExpressItems: typeof orders = [];
    const jtCargoItems: typeof orders = [];
    const vnpostItems: typeof orders = [];
    const bestItems: typeof orders = [];
    const otherItems: typeof orders = [];

    for (const item of orders) {
      const upper = (item.code || '').toUpperCase().trim();
      let resolvedCarrier = item.carrier;

      // Unambiguous tracking code formats MUST take precedence
      if (
        upper.startsWith('SPXVN') || 
        upper.startsWith('SPX') || 
        upper.startsWith('VNSPX') || 
        upper.startsWith('SPE') ||
        upper.startsWith('VNSP')
      ) {
        resolvedCarrier = 'spx';
      } else if (
        upper.startsWith('VNGH') || 
        upper.startsWith('GY') || 
        upper.startsWith('G8') || 
        upper.startsWith('GHN') ||
        upper.startsWith('NL_') ||
        (upper.length === 8 && /^[A-Z0-9]{8}$/.test(upper) && upper.startsWith('G'))
      ) {
        resolvedCarrier = 'ghn';
      } else if (
        upper.startsWith('NIVN') || 
        upper.startsWith('NLVN') || 
        upper.startsWith('NV') ||
        (upper.startsWith('SHP') && upper.length > 10)
      ) {
        resolvedCarrier = 'ninjavan';
      } else if (
        upper.startsWith('EMS') ||
        upper.startsWith('VNPOST') ||
        /^[A-Z]{2}\d{8,11}VN$/i.test(upper) ||
        /^[ECRV][A-Z0-9]{8,11}VN$/i.test(upper)
      ) {
        resolvedCarrier = 'vnpost';
      } else if (
        upper.startsWith('TTVN') ||
        upper.startsWith('BEST') ||
        ((upper.startsWith('61') || upper.startsWith('81')) && upper.length === 12 && /^\d+$/.test(upper))
      ) {
        resolvedCarrier = 'best';
      } else if (upper.startsWith('VT') || upper.startsWith('VTP')) {
        resolvedCarrier = 'viettelpost';
      } else if (
        // J&T Cargo: 530xxxxxxxxx (12-13 digit codes starting with 530)
        /^530\d+$/.test(upper) ||
        (/^53\d+$/.test(upper) && upper.length >= 11 && upper.length <= 13)
      ) {
        resolvedCarrier = 'jt_cargo';
      } else if (
        upper.startsWith('8') ||
        upper.startsWith('JT') || 
        upper.startsWith('JTE') || 
        upper.startsWith('JNT')
      ) {
        resolvedCarrier = 'jt';
      }

      item.carrier = resolvedCarrier;

      if (resolvedCarrier === 'jt_cargo') {
        jtCargoItems.push(item);
      } else if (resolvedCarrier === 'jt') {
        jtExpressItems.push(item);
      } else if (resolvedCarrier === 'vnpost') {
        vnpostItems.push(item);
      } else if (resolvedCarrier === 'best') {
        bestItems.push(item);
      } else {
        otherItems.push(item);
      }
    }

    // Process J&T Cargo (530* codes) - parallel with concurrency 5
    const cargoCodes = jtCargoItems.map(o => o.code);
    const cargoResults = await fetchJNTCargoBatchLive(cargoCodes, isGlobalForce);
    for (const [code, resObj] of Object.entries(cargoResults)) {
      results[code] = resObj;
    }

    // Process VNPost / EMS in parallel
    const vnpostCodes = vnpostItems.map(o => o.code);
    const vnpostResults = await fetchVNPostBatchLive(vnpostCodes, isGlobalForce);
    for (const [code, resObj] of Object.entries(vnpostResults)) {
      results[code] = resObj;
    }

    // Process Best Express in parallel
    const bestCodes = bestItems.map(o => o.code);
    const bestResults = await fetchBestBatchLive(bestCodes, isGlobalForce);
    for (const [code, resObj] of Object.entries(bestResults)) {
      results[code] = resObj;
    }

    // Process J&T Express in chunks of up to 10 codes (1 HTTP call per 10 codes)
    const JT_CHUNK_SIZE = 10;
    const jtChunks: (typeof jtExpressItems)[] = [];
    for (let i = 0; i < jtExpressItems.length; i += JT_CHUNK_SIZE) {
      jtChunks.push(jtExpressItems.slice(i, i + JT_CHUNK_SIZE));
    }
    await Promise.all(
      jtChunks.map(async (jtChunk) => {
        const codes = jtChunk.map(o => o.code);
        const phone = jtChunk.find(o => o.cellphone)?.cellphone;
        const batchRes = await fetchJNTBatchLive(codes, phone, isGlobalForce);
        for (const [code, resObj] of Object.entries(batchRes)) {
          results[code] = resObj;
        }
      })
    );

    // Process other carriers in parallel with concurrency
    const concurrency = 25;
    for (let i = 0; i < otherItems.length; i += concurrency) {
      const chunk = otherItems.slice(i, i + concurrency);
      await Promise.all(
        chunk.map(async (item) => {
          const upper = (item.code || '').toUpperCase().trim();
          const itemForce = Boolean(isGlobalForce || item.force);
          if (item.carrier === 'spx' || upper.startsWith('SPX') || upper.startsWith('VNSPX') || upper.startsWith('SPE') || upper.startsWith('VNSP')) {
            const spxRes = await fetchSPXLive(item.code, itemForce);
            results[item.code] = spxRes;
          } else if (
            item.carrier === 'ghn' || 
            upper.startsWith('VNGH') || 
            upper.startsWith('GY') || 
            upper.startsWith('G8') || 
            upper.startsWith('GHN') ||
            upper.startsWith('NL_') ||
            (upper.length === 8 && /^[A-Z0-9]{8}$/.test(upper) && upper.startsWith('G'))
          ) {
            const ghnRes = await fetchGHNLive(item.code, item.cellphone, itemForce);
            results[item.code] = ghnRes;
          } else if (item.carrier === 'ninjavan' || upper.startsWith('NIVN') || upper.startsWith('SHP')) {
            const nvRes = await fetchNinjaVanLive(item.code);
            results[item.code] = nvRes;
          } else if (
            item.carrier === 'vnpost' ||
            upper.startsWith('EMS') ||
            upper.startsWith('VNPOST') ||
            /^[A-Z]{2}\d{8,11}VN$/i.test(upper) ||
            /^[ECRV][A-Z0-9]{8,11}VN$/i.test(upper)
          ) {
            const vnpostRes = await fetchVNPostLive(item.code, itemForce);
            results[item.code] = vnpostRes;
          } else if (
            item.carrier === 'best' ||
            upper.startsWith('BEST') ||
            ((upper.startsWith('61') || upper.startsWith('81')) && upper.length === 12 && /^\d+$/.test(upper))
          ) {
            const bestRes = await fetchBestLive(item.code, itemForce);
            results[item.code] = bestRes;
          } else {
            results[item.code] = {
              success: false,
              error: `Chưa có API tra cứu tự động cho hãng ${item.carrier || 'này'}`
            };
          }
        })
      );
    }

    res.json({ success: true, results });
  });

  // Vite middleware for development vs Production static serving
  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));
  const isProduction = process.env.NODE_ENV === "production" || hasDist;

  if (!isProduction) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        watch: {
          ignored: [
            "**/data/**",
            "**/*.sqlite*",
            "**/*.sqlite-wal*",
            "**/*.sqlite-shm*",
            "**/*.json",
            "**/batch_results*"
          ]
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
