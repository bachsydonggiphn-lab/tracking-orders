import { CarrierId, OrderItem, TrackingEvent, TrackingStatusCategory } from '../types/tracking';
import { CARRIERS, detectCarrier, getDirectTrackingUrl } from './carrierDetector';

// Cache to prevent duplicate lookups
const trackingCache = new Map<string, Partial<OrderItem>>();

/**
 * Safely extracts the actual pickup/first-received scan timestamp from tracking timeline.
 * Explicitly ignores pre-pickup issue logs (e.g. "Kiện Vấn Đề", "Kiện khó") or creation logs.
 */
export function extractScannedAtTime(timeline: TrackingEvent[] = []): string | undefined {
  if (!timeline || timeline.length === 0) return undefined;

  // 1. Search chronologically (from earliest to latest, i.e. reversed array) for explicit courier/hub pickup scans
  const pickupItem = timeline.slice().reverse().find(item => {
    const txt = (item.statusText || '').toLowerCase();
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
           txt.includes('đến bưu cục') ||
           txt.includes('lấy hàng thành công') || 
           txt.includes('đã lấy hàng') || 
           txt.includes('tiếp nhận') || 
           txt.includes('quét mã tiếp nhận') || 
           txt.includes('nhận hàng thành công') ||
           txt.includes('chấp nhận gửi') ||
           txt.includes('chấp nhận') ||
           txt.includes('thu gom thành công') ||
           txt.includes('picked up');
  });

  if (pickupItem) {
    return pickupItem.time;
  }

  // 2. If no explicit pickup keyword found, find the earliest event that is NOT a problem log, failed pickup or initial creation
  const validTransitItem = timeline.slice().reverse().find(item => {
    const txt = (item.statusText || '').toLowerCase();
    const isExcluded = txt.includes('kiện vấn đề') || 
                       txt.includes('kiện khó') || 
                       txt.includes('vấn đề') || 
                       txt.includes('tạo đơn') || 
                       txt.includes('được tạo') || 
                       txt.includes('chờ lấy') ||
                       txt.includes('chuẩn bị') ||
                       txt.includes('không thành công') ||
                       txt.includes('thất bại') ||
                       txt.includes('hẹn lại') ||
                       txt.includes('f001');
    return !isExcluded;
  });

  if (validTransitItem) {
    return validTransitItem.time;
  }

  // If no pickup scan exists (e.g. only "Kiện Vấn Đề", "Kiện khó", "Tạo đơn"), the parcel was NOT picked up!
  return undefined;
}

/**
 * Robust logistics classifier that determines the correct status category and timestamp
 * based on raw status strings and timeline history.
 */
export function classifyLogisticsStatus(
  rawStatusText: string, 
  timeline: TrackingEvent[] = [],
  fallbackCategory: TrackingStatusCategory = 'not_scanned'
): { statusCategory: TrackingStatusCategory; scannedAt?: string } {
  const rawLower = (rawStatusText || '').toLowerCase().trim();
  const latestEventText = (timeline[0]?.statusText || '').toLowerCase().trim();
  const fullLogText = timeline.map(t => `${t.statusText} ${t.description || ''}`).join(' ').toLowerCase();
  const scannedTime = extractScannedAtTime(timeline);
  const hasPickup = Boolean(scannedTime);

  // 1. Cancelled
  if (
    rawLower.includes('đã hủy') ||
    rawLower.includes('đã huỷ') ||
    rawLower.includes('hủy') ||
    rawLower.includes('huỷ') ||
    rawLower.includes('hủy đơn') ||
    rawLower.includes('hủy phiếu') ||
    rawLower.includes('hủy yêu cầu') ||
    rawLower.includes('cancelled') ||
    rawLower.includes('canceled') ||
    rawLower.includes('cancel') ||
    rawLower.includes('từ chối nhận lúc lấy') ||
    rawLower.includes('đã xóa') ||
    rawLower.includes('đã cắt đơn') ||
    latestEventText.includes('hủy') ||
    latestEventText.includes('huỷ') ||
    latestEventText.includes('cancelled') ||
    latestEventText.includes('canceled') ||
    latestEventText.includes('f950') ||
    fullLogText.includes('f950') ||
    fullLogText.includes('pickup request canceled') ||
    fullLogText.includes('thông báo đơn hàng đã bị hủy')
  ) {
    return { statusCategory: 'cancelled', scannedAt: undefined };
  }

  // 2. Returned / Chuyển hoàn / Trả hàng
  if (
    rawLower.includes('chuyển hoàn') ||
    rawLower.includes('trả hàng') ||
    rawLower.includes('hoàn hàng') ||
    rawLower.includes('returning') ||
    rawLower.includes('returned') ||
    latestEventText.includes('trả hàng') ||
    latestEventText.includes('chuyển hoàn') ||
    latestEventText.includes('hoàn trả')
  ) {
    return { statusCategory: 'returned', scannedAt: scannedTime };
  }

  // 3. Delivered / Ký nhận thành công
  // Check if raw status or latest event indicates delivery to recipient
  if (
    rawLower.includes('giao hàng thành công') ||
    rawLower.includes('giao thành công') ||
    rawLower.includes('đã giao hàng') ||
    rawLower.includes('phát thành công') ||
    rawLower.includes('đã phát') ||
    rawLower.includes('đã ký nhận') ||
    rawLower.includes('ký nhận thành công') ||
    rawLower.includes('người nhận đã nhận') ||
    rawLower.includes('khách đã nhận') ||
    rawLower.includes('delivered') ||
    latestEventText.includes('giao hàng thành công') ||
    latestEventText.includes('giao thành công') ||
    latestEventText.includes('đã ký nhận') ||
    latestEventText.includes('phát thành công') ||
    latestEventText.includes('delivered')
  ) {
    return { statusCategory: 'delivered', scannedAt: scannedTime };
  }

  // 4. Kiện vấn đề / Kiện khó (Phát hiện sự cố lấy hàng hoặc sự cố giao hàng)
  if (
    rawLower.includes('kiện vấn đề') ||
    rawLower.includes('kiện khó') ||
    latestEventText.includes('kiện vấn đề') ||
    latestEventText.includes('kiện khó')
  ) {
    if (hasPickup) {
      // Đã lấy hàng, đang giao hoặc phát sinh kiện khó lúc giao => Đang vận chuyển (Đã scan)
      return { statusCategory: 'in_transit', scannedAt: scannedTime };
    } else {
      return { statusCategory: 'not_scanned', scannedAt: undefined };
    }
  }

  // 5. In Transit / Delivering (Shipper đang đi giao hoặc đang trung chuyển)
  if (
    rawLower.includes('đang giao') ||
    rawLower.includes('đang phát') ||
    rawLower.includes('đang vận chuyển') ||
    rawLower.includes('đang chuyển hàng') ||
    rawLower.includes('trung chuyển') ||
    rawLower.includes('luân chuyển') ||
    rawLower.includes('phân tuyến') ||
    rawLower.includes('phân loại') ||
    rawLower.includes('xuất kho') ||
    rawLower.includes('đến kho') ||
    rawLower.includes('rời kho') ||
    rawLower.includes('đến bưu cục') ||
    rawLower.includes('rời bưu cục') ||
    rawLower.includes('lên xe') ||
    rawLower.includes('sắp xếp tài xế') ||
    rawLower.includes('sớm được giao') ||
    rawLower.includes('sẵn sàng trung chuyển') ||
    rawLower.includes('sẵn sàng giao') ||
    rawLower.includes('nhập kho trung chuyển') ||
    rawLower.includes('in_transit') ||
    rawLower.includes('transporting') ||
    rawLower.includes('delivering') ||
    rawLower.includes('đến trạm') ||           // Đã đến trạm giao hàng khu vực
    rawLower.includes('trạm giao hàng') ||     // Trạm giao hàng cuối (last-mile hub)
    rawLower.includes('sẽ được giao') ||       // Sẽ được giao trong vòng 12 giờ
    rawLower.includes('đang trên đường giao') ||
    rawLower.includes('shipper đang') ||
    rawLower.includes('bưu tá đang') ||
    latestEventText.includes('đang giao') ||
    latestEventText.includes('đang phát') ||
    latestEventText.includes('đang vận chuyển') ||
    latestEventText.includes('trung chuyển') ||
    latestEventText.includes('đến trạm') ||
    latestEventText.includes('trạm giao hàng') ||
    latestEventText.includes('sẽ được giao') ||
    latestEventText.includes('đến bưu cục') ||
    latestEventText.includes('rời bưu cục') ||
    latestEventText.includes('lên xe') ||
    latestEventText.includes('đến kho') ||
    latestEventText.includes('rời kho') ||
    latestEventText.includes('sắp xếp tài xế') ||
    latestEventText.includes('sớm được giao') ||
    latestEventText.includes('sẵn sàng trung chuyển') ||
    latestEventText.includes('phân loại')
  ) {
    return { statusCategory: 'in_transit', scannedAt: scannedTime };
  }

  // 5b. Pickup Failed / Lấy hàng không thành công (Hẹn lại ngày lấy, hàng chưa ra khỏi kho)
  const isPickupFailed = rawLower.includes('lấy hàng không thành công') || 
                         rawLower.includes('chưa lấy được') ||
                         latestEventText.includes('lấy hàng không thành công') ||
                         latestEventText.includes('chưa lấy được') ||
                         latestEventText.includes('hẹn lại ngày lấy') ||
                         fullLogText.includes('f001') && !hasPickup;
  if (isPickupFailed) {
    return { statusCategory: 'not_scanned', scannedAt: undefined };
  }

  // 6. Scanned / Picked up by courier / Hub received
  if (
    !rawLower.includes('không thành công') &&
    !latestEventText.includes('không thành công') && (
      rawLower.includes('đã lấy hàng') ||
      rawLower.includes('đã lấy') ||
      rawLower.includes('đã scan') ||
      rawLower.includes('quét mã tiếp nhận') ||
      rawLower.includes('tiếp nhận') ||
      rawLower.includes('đã nhận hàng') ||
      rawLower.includes('nhân viên đã nhận') ||
      rawLower.includes('bưu tá đã nhận') ||
      rawLower.includes('bưu cục đã nhận') ||
      rawLower.includes('nhập bưu cục') ||
      rawLower.includes('picked up') ||
      rawLower.includes('storing') ||
      latestEventText.includes('đã lấy') ||
      latestEventText.includes('tiếp nhận') ||
      latestEventText.includes('đã nhận hàng') ||
      latestEventText.includes('quét mã') ||
      latestEventText.includes('bưu tá')
    )
  ) {
    return { statusCategory: 'scanned', scannedAt: scannedTime };
  }

  // 7. Not Scanned / Ready to pick / Seller preparing
  if (
    rawLower.includes('chờ lấy') ||
    rawLower.includes('chưa scan') ||
    rawLower.includes('chưa lấy') ||
    rawLower.includes('chuẩn bị hàng') ||
    rawLower.includes('mới tạo') ||
    rawLower.includes('đã tạo') ||
    rawLower.includes('ready_to_pick') ||
    rawLower.includes('created') ||
    latestEventText.includes('chuẩn bị hàng') ||
    latestEventText.includes('chờ lấy') ||
    latestEventText.includes('được tạo')
  ) {
    return { statusCategory: 'not_scanned', scannedAt: undefined };
  }

  // If no pickup scan exists at all in timeline, and fallbackCategory is 'scanned',
  // it should NEVER be marked 'scanned' without pickup proof!
  if (!hasPickup && fallbackCategory === 'scanned') {
    return { statusCategory: 'not_scanned', scannedAt: undefined };
  }

  return { statusCategory: fallbackCategory, scannedAt: scannedTime };
}

export function clearTrackingCache() {
  trackingCache.clear();
  try {
    fetch('/api/track/clear-cache', { method: 'POST' }).catch(() => {});
  } catch {}
}

/**
 * Normalizes any carrier raw status string into the 7 standard business categories
 */
export function categorizeStatus(statusText: string): TrackingStatusCategory {
  const lower = (statusText || '').toLowerCase();

  // 1. Cancelled checks
  if (
    lower.includes('hủy') || 
    lower.includes('cancel') || 
    lower.includes('huỷ') ||
    lower.includes('từ chối nhận lúc lấy') ||
    lower.includes('shop huỷ')
  ) {
    return 'cancelled';
  }

  // 2. Delivered checks
  if (
    lower.includes('thành công') || 
    lower.includes('delivered') || 
    lower.includes('đã giao') || 
    lower.includes('ký nhận') ||
    lower.includes('phát thành công')
  ) {
    return 'delivered';
  }

  // 3. Return / Failed
  if (
    lower.includes('hoàn') || 
    lower.includes('trả hàng') || 
    lower.includes('return') || 
    lower.includes('giao không thành công') ||
    lower.includes('thất bại')
  ) {
    return 'returned';
  }

  // 4. Kiện vấn đề / Kiện khó (Chưa lấy hàng)
  if (lower.includes('kiện vấn đề') || lower.includes('kiện khó')) {
    return 'not_scanned';
  }

  // 5. Not Scanned / Pending Pickup
  if (
    lower.includes('chưa scan') || 
    lower.includes('chờ lấy') || 
    lower.includes('chờ bưu tá') || 
    lower.includes('chờ gửi') || 
    lower.includes('mới tạo') || 
    lower.includes('chưa lấy') || 
    lower.includes('ready to ship') ||
    lower.includes('pending pickup') ||
    lower.includes('đã tạo vận đơn')
  ) {
    return 'not_scanned';
  }

  // 6. In transit / Delivering
  if (
    lower.includes('đang giao') || 
    lower.includes('đang phát') || 
    lower.includes('đang vận chuyển') || 
    lower.includes('luân chuyển') || 
    lower.includes('out for delivery') ||
    lower.includes('trung chuyển')
  ) {
    return 'in_transit';
  }

  // 7. Scanned / Picked up (Entered warehouse / driver scanned)
  if (
    lower.includes('đã scan') || 
    lower.includes('đã lấy') || 
    lower.includes('đã nhận hàng') || 
    lower.includes('nhập kho') || 
    lower.includes('quét') || 
    lower.includes('bưu tá đã lấy') || 
    lower.includes('picked up') ||
    lower.includes('đang phân loại') ||
    lower.includes('đã tiếp nhận')
  ) {
    return 'scanned';
  }

  // 8. Error / Not found
  if (
    lower.includes('không tìm thấy') || 
    lower.includes('lỗi') || 
    lower.includes('không tồn tại') || 
    lower.includes('not found')
  ) {
    return 'error';
  }

  return 'not_scanned';
}

/**
 * Format relative / standard datetime
 */
function getTimestamp(hoursAgo: number = 0, minutesAgo: number = 0): string {
  const d = new Date(Date.now() - (hoursAgo * 3600 + minutesAgo * 60) * 1000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

async function safeFetchApi(url: string, body: any, timeoutMs: number = 15000): Promise<{
  ok: boolean;
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    clearTimeout(timeoutId);

    const text = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        ok: false,
        success: false,
        error: 'Máy chủ phản hồi trang bảo trì hoặc đang bận'
      };
    }

    if (res.ok && json && json.success) {
      return { ok: true, success: true, data: json.data, error: undefined };
    } else {
      let errMsg = json?.error || (json?.message ? String(json.message) : undefined);
      if (!errMsg || errMsg.includes('Unexpected token') || errMsg.includes('is not valid JSON') || errMsg.includes('<!DOCTYPE')) {
        errMsg = 'Không tìm thấy dữ liệu vận đơn';
      }
      return { ok: res.ok, success: false, data: json?.data, error: errMsg };
    }
  } catch (err: any) {
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      success: false,
      error: isTimeout ? 'Quá thời gian kết nối' : (err?.message || 'Lỗi kết nối')
    };
  }
}

function jsonSafeText(str?: string, defaultFallback: string = ''): string {
  if (!str) return defaultFallback;
  if (str.includes('Unexpected token') || str.includes('is not valid JSON') || str.includes('<!DOCTYPE') || str.includes('<html')) {
    return 'Hệ thống đang đồng bộ tiến độ quét...';
  }
  return str;
}

/**
 * Simulates or fetches actual carrier response
 */
export async function trackSingleOrder(
  code: string, 
  forcedCarrier?: CarrierId,
  customerPhone?: string,
  forceRefresh: boolean = false,
  fallbackJtPhoneSuffix: string = '8036'
): Promise<{
  carrier: CarrierId;
  statusCategory: TrackingStatusCategory;
  rawStatusText: string;
  statusDetail: string;
  scannedAt?: string;
  updatedAt?: string;
  timeline: TrackingEvent[];
  error?: string;
}> {
  const cleanCode = code.trim();
  const detected = detectCarrier(cleanCode);
  const carrier: CarrierId = detected !== 'unknown' 
    ? detected 
    : (forcedCarrier && forcedCarrier !== 'unknown' ? forcedCarrier : 'unknown');

  const effectivePhone = customerPhone?.replace(/\D/g, '').slice(-4) || fallbackJtPhoneSuffix || '8036';
  const cacheKey = `${carrier}:${cleanCode}:${effectivePhone}`;
  if (!forceRefresh && trackingCache.has(cacheKey)) {
    const cached = trackingCache.get(cacheKey)!;
    return {
      carrier: cached.carrier || carrier,
      statusCategory: cached.statusCategory || 'scanned',
      rawStatusText: cached.rawStatusText || 'Đã scan - Đang xử lý',
      statusDetail: cached.statusDetail || '',
      scannedAt: cached.scannedAt,
      timeline: cached.timeline || [],
      error: cached.error
    };
  }

  const upperCode = cleanCode.toUpperCase();

  // 1. Shopee Express (SPX) tracking (Check First)
  if (
    carrier === 'spx' || 
    upperCode.startsWith('SPXVN') || 
    upperCode.startsWith('SPX') || 
    upperCode.startsWith('VNSPX') || 
    upperCode.startsWith('SPE') ||
    upperCode.startsWith('VNSP')
  ) {
    try {
      const apiRes = await safeFetchApi('/api/track/spx', { orderCode: cleanCode, force: forceRefresh });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'spx' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          updatedAt: apiRes.data.updatedAt || liveTimeline[0]?.time,
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'SPX: Không tìm thấy dữ liệu vận đơn trên cổng Shopee Express';
        const isTimeoutOrNetwork = errDetail.includes('Quá thời gian') || errDetail.includes('kết nối') || errDetail.includes('bảo trì') || errDetail.includes('bận');
        const isNotFound = errDetail.includes('Không tìm thấy') || errDetail.includes('chưa có') || errDetail.includes('không tồn tại');
        
        if (isTimeoutOrNetwork || isNotFound) {
          return {
            carrier: 'spx' as CarrierId,
            statusCategory: 'not_scanned' as TrackingStatusCategory,
            rawStatusText: 'Chờ Shopee Express lấy hàng (Chưa scan)',
            statusDetail: isTimeoutOrNetwork 
              ? 'Hệ thống đang kết nối với cổng SPX, vui lòng thử lại sau giây lát' 
              : 'Mã vận đơn đã tạo trên Shopee, bưu tá SPX chưa tới lấy kiện',
            timeline: [],
            error: undefined
          };
        }
        const errData = {
          carrier: 'spx' as CarrierId,
          statusCategory: 'error' as TrackingStatusCategory,
          rawStatusText: 'Lỗi tra cứu SPX',
          statusDetail: errDetail,
          timeline: [],
          error: errDetail
        };
        return errData;
      }
    } catch (err: any) {
      return {
        carrier: 'spx' as CarrierId,
        statusCategory: 'not_scanned',
        rawStatusText: 'Chờ Shopee Express lấy hàng (Chưa scan)',
        statusDetail: 'Hệ thống đang kết nối với cổng SPX...',
        timeline: [],
        error: undefined
      };
    }
  }

  // 2. Giao Hàng Nhanh (GHN) tracking
  if (
    carrier === 'ghn' || 
    upperCode.startsWith('VNGH') || 
    upperCode.startsWith('GY') || 
    upperCode.startsWith('G8') || 
    upperCode.startsWith('GHN') ||
    upperCode.startsWith('NL_') ||
    (upperCode.length === 8 && /^[A-Z0-9]{8}$/.test(upperCode) && upperCode.startsWith('G'))
  ) {
    try {
      const apiRes = await safeFetchApi('/api/track/ghn', { 
        orderCode: cleanCode, 
        cellphone: effectivePhone 
      });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'ghn' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'GHN: Không tìm thấy dữ liệu vận đơn';
        const isTimeoutOrNetwork = errDetail.includes('Quá thời gian') || errDetail.includes('kết nối') || errDetail.includes('bảo trì') || errDetail.includes('bận');
        const isNotFound = errDetail.includes('Không tìm thấy') || errDetail.includes('chưa có') || errDetail.includes('không tồn tại');
        
        if (isTimeoutOrNetwork || isNotFound) {
          return {
            carrier: 'ghn' as CarrierId,
            statusCategory: 'not_scanned' as TrackingStatusCategory,
            rawStatusText: 'Chờ GHN lấy hàng (Chưa scan)',
            statusDetail: isTimeoutOrNetwork 
              ? 'Hệ thống đang kết nối với cổng GHN, vui lòng thử lại sau giây lát' 
              : 'Mã vận đơn đã tạo, chờ bưu tá GHN tới lấy hàng',
            timeline: [],
            error: undefined
          };
        }
        const errData = {
          carrier: 'ghn' as CarrierId,
          statusCategory: 'error' as TrackingStatusCategory,
          rawStatusText: 'Lỗi kết nối GHN',
          statusDetail: errDetail,
          timeline: [],
          error: errDetail
        };
        return errData;
      }
    } catch (err: any) {
      return {
        carrier: 'ghn' as CarrierId,
        statusCategory: 'not_scanned',
        rawStatusText: 'Chờ GHN lấy hàng (Chưa scan)',
        statusDetail: 'Hệ thống đang kết nối lại với cổng GHN...',
        timeline: [],
        error: undefined
      };
    }
  }

  // 3. J&T Express tracking
  // Quy tắc: Miễn là mã vận đơn mang đầu số "8" thì là đơn J&T
  if (
    (carrier === 'jt' || 
    upperCode.startsWith('8') ||
    upperCode.startsWith('JT') || 
    upperCode.startsWith('JTE') || 
    upperCode.startsWith('JNT') || 
    upperCode.startsWith('530') || 
    (/^\d{11,13}$/.test(cleanCode) && cleanCode.startsWith('53'))) && 
    !upperCode.startsWith('SPX') &&
    !upperCode.startsWith('VNGH') &&
    !upperCode.startsWith('NIVN')
  ) {
    const isCargo = cleanCode.startsWith('530') || (cleanCode.startsWith('53') && cleanCode.length >= 11);
    try {
      const apiRes = await safeFetchApi('/api/track/jnt', { 
        billCode: cleanCode, 
        cellphone: effectivePhone
      });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'jt' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          updatedAt: apiRes.data.updatedAt || (liveTimeline[0]?.time),
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'J&T: Không tìm thấy thông tin vận đơn hoặc cần 4 số cuối SĐT';
        const isTimeoutOrNetwork = errDetail.includes('Quá thời gian') || errDetail.includes('kết nối') || errDetail.includes('bảo trì') || errDetail.includes('bận');
        const isNotFound = errDetail.includes('Không tìm thấy') || errDetail.includes('chưa có') || errDetail.includes('không tồn tại') || isCargo;
        
        if (isTimeoutOrNetwork || isNotFound) {
          return {
            carrier: 'jt' as CarrierId,
            statusCategory: 'not_scanned' as TrackingStatusCategory,
            rawStatusText: isCargo ? 'Chờ J&T Cargo lấy hàng (Chưa scan)' : 'Chờ J&T Express lấy hàng (Chưa scan)',
            statusDetail: isCargo 
              ? 'Mã vận đơn đã tạo trên WMS, đang chờ bưu cục J&T Cargo quét tiếp nhận'
              : 'Đơn mới xuất kho WMS, đang chờ bưu tá J&T Express đến lấy kiện và quét mã',
            timeline: [],
            error: undefined
          };
        }
        const errData = {
          carrier: 'jt' as CarrierId,
          statusCategory: 'error' as TrackingStatusCategory,
          rawStatusText: 'Lỗi tra cứu J&T',
          statusDetail: errDetail,
          timeline: [],
          error: errDetail
        };
        return errData;
      }
    } catch (err: any) {
      return {
        carrier: 'jt' as CarrierId,
        statusCategory: 'not_scanned' as TrackingStatusCategory,
        rawStatusText: isCargo ? 'Chờ J&T Cargo lấy hàng (Chưa scan)' : 'Chờ J&T Express lấy hàng (Chưa scan)',
        statusDetail: 'Mã vận đơn đã tạo, chờ đồng bộ tiến độ quét',
        timeline: [],
        error: undefined
      };
    }
  }

  // 4. Ninja Van tracking
  if (carrier === 'ninjavan' || upperCode.startsWith('NIVN') || upperCode.startsWith('SHP')) {
    try {
      const apiRes = await safeFetchApi('/api/track/ninjavan', { trackingId: cleanCode });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'ninjavan' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'Ninja Van: Không tìm thấy dữ liệu vận đơn';
        return {
          carrier: 'ninjavan' as CarrierId,
          statusCategory: 'error' as TrackingStatusCategory,
          rawStatusText: 'Lỗi tra cứu Ninja Van',
          statusDetail: errDetail,
          timeline: [],
          error: errDetail
        };
      }
    } catch (err: any) {
      return {
        carrier: 'ninjavan' as CarrierId,
        statusCategory: 'error',
        rawStatusText: 'Lỗi mạng Ninja Van',
        statusDetail: 'Không thể kết nối',
        timeline: [],
        error: 'Lỗi mạng'
      };
    }
  }

  // 5. VNPost / EMS tracking
  if (
    carrier === 'vnpost' ||
    upperCode.startsWith('EMS') ||
    upperCode.startsWith('VNPOST') ||
    /^[A-Z]{2}\d{8,11}VN$/i.test(upperCode) ||
    /^[ECRV][A-Z0-9]{8,11}VN$/i.test(upperCode)
  ) {
    try {
      const apiRes = await safeFetchApi('/api/track/vnpost', { orderCode: cleanCode, force: forceRefresh });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'vnpost' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          updatedAt: apiRes.data.updatedAt || (liveTimeline[0]?.time),
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'VNPost: Không tìm thấy dữ liệu vận đơn';
        const isTimeoutOrNetwork = errDetail.includes('Quá thời gian') || errDetail.includes('kết nối') || errDetail.includes('bảo trì') || errDetail.includes('bận');
        const isNotFound = errDetail.includes('Không tìm thấy') || errDetail.includes('chưa có') || errDetail.includes('không tồn tại');

        if (isTimeoutOrNetwork || isNotFound) {
          return {
            carrier: 'vnpost' as CarrierId,
            statusCategory: 'not_scanned' as TrackingStatusCategory,
            rawStatusText: 'Chờ VNPost/EMS lấy hàng (Chưa scan)',
            statusDetail: isTimeoutOrNetwork 
              ? 'Hệ thống đang kết nối với cổng Bưu điện VNPost/EMS, vui lòng thử lại sau giây lát' 
              : 'Mã vận đơn đã tạo, đang chờ bưu tá VNPost/EMS đến lấy kiện',
            timeline: [],
            error: undefined
          };
        }
        return {
          carrier: 'vnpost' as CarrierId,
          statusCategory: 'error' as TrackingStatusCategory,
          rawStatusText: 'Lỗi tra cứu VNPost',
          statusDetail: errDetail,
          timeline: [],
          error: errDetail
        };
      }
    } catch (err: any) {
      return {
        carrier: 'vnpost' as CarrierId,
        statusCategory: 'not_scanned',
        rawStatusText: 'Chờ VNPost/EMS lấy hàng (Chưa scan)',
        statusDetail: 'Hệ thống đang kết nối lại với cổng VNPost...',
        timeline: [],
        error: undefined
      };
    }
  }

  // 6. Best Express tracking
  if (
    carrier === 'best' ||
    upperCode.startsWith('TTVN') ||
    upperCode.startsWith('BEST') ||
    ((upperCode.startsWith('61') || upperCode.startsWith('81')) && upperCode.length === 12 && /^\d+$/.test(upperCode))
  ) {
    try {
      const apiRes = await safeFetchApi('/api/track/best', { orderCode: cleanCode, force: forceRefresh });

      if (apiRes.success && apiRes.data) {
        const liveTimeline = apiRes.data.timeline || [];
        const classified = classifyLogisticsStatus(apiRes.data.rawStatusText || '', liveTimeline, apiRes.data.statusCategory as TrackingStatusCategory);
        const liveData = {
          carrier: 'best' as CarrierId,
          statusCategory: classified.statusCategory,
          rawStatusText: jsonSafeText(apiRes.data.rawStatusText, 'Đang vận chuyển'),
          statusDetail: jsonSafeText(apiRes.data.statusDetail, ''),
          scannedAt: apiRes.data.scannedAt || classified.scannedAt,
          updatedAt: apiRes.data.updatedAt || (liveTimeline[0]?.time),
          timeline: liveTimeline,
          error: undefined
        };
        trackingCache.set(cacheKey, liveData);
        return liveData;
      } else {
        const errDetail = apiRes.error || 'BEST Express: Không tìm thấy dữ liệu vận đơn';
        return {
          carrier: 'best' as CarrierId,
          statusCategory: 'not_scanned' as TrackingStatusCategory,
          rawStatusText: 'Chờ BEST Express lấy hàng (Chưa scan)',
          statusDetail: errDetail,
          timeline: [],
          error: undefined
        };
      }
    } catch (err: any) {
      return {
        carrier: 'best' as CarrierId,
        statusCategory: 'not_scanned',
        rawStatusText: 'Chờ BEST Express lấy hàng (Chưa scan)',
        statusDetail: 'Hệ thống đang kết nối lại với cổng BEST Express...',
        timeline: [],
        error: undefined
      };
    }
  }

  // Unsupported or unknown carrier
  return {
    carrier,
    statusCategory: 'error',
    rawStatusText: 'Chưa hỗ trợ API',
    statusDetail: `Hãng vận chuyển [${carrier}] chưa có cổng API tra cứu tự động. Vui lòng bấm liên kết tra cứu trực tiếp.`,
    timeline: [],
    error: `Chưa hỗ trợ tự động hãng ${carrier}`
  };
}

/**
 * High-speed batch tracking that sends multi-item chunks to backend API
 */
export async function trackBatchOrders(
  orders: { code: string; carrier?: CarrierId; cellphone?: string }[],
  force: boolean = false
): Promise<Record<string, {
  carrier: CarrierId;
  statusCategory: TrackingStatusCategory;
  rawStatusText: string;
  statusDetail: string;
  scannedAt?: string;
  updatedAt?: string;
  timeline: TrackingEvent[];
  error?: string;
}>> {
  if (orders.length === 0) return {};
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch('/api/track/batch', {
      signal: controller.signal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders, force })
    });
    clearTimeout(timeoutId);
    
    if (res.ok) {
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        // Ignored, not JSON
      }
      if (json && json.success && json.results) {
        const out: Record<string, any> = {};
        for (const [code, itemRes] of Object.entries<any>(json.results)) {
          const matchingOrder = orders.find(o => o.code === code);
          const detected = detectCarrier(code);
          const carrier = itemRes.data?.carrier || (detected !== 'unknown' 
            ? detected 
            : (matchingOrder?.carrier && matchingOrder.carrier !== 'unknown' ? matchingOrder.carrier : 'unknown'));

          if (itemRes.success && itemRes.data) {
            const liveTimeline = itemRes.data.timeline || [];
            const classified = classifyLogisticsStatus(itemRes.data.rawStatusText || '', liveTimeline, itemRes.data.statusCategory);
            out[code] = {
              carrier: itemRes.data.carrier || carrier,
              statusCategory: classified.statusCategory,
              rawStatusText: jsonSafeText(itemRes.data.rawStatusText, 'Đang vận chuyển'),
              statusDetail: jsonSafeText(itemRes.data.statusDetail, ''),
              scannedAt: itemRes.data.scannedAt || classified.scannedAt,
              updatedAt: itemRes.data.updatedAt || (liveTimeline[0]?.time),
              timeline: liveTimeline,
              error: undefined
            };
          } else {
            let errDetail = itemRes.error || 'Không tìm thấy dữ liệu vận đơn';
            if (errDetail.includes('Unexpected token') || errDetail.includes('is not valid JSON') || errDetail.includes('<!DOCTYPE')) {
              errDetail = 'Đang đồng bộ lại với cổng hãng vận chuyển...';
            }
            const isCargo = code.startsWith('530') || (code.startsWith('53') && code.length >= 11);
            const isTimeoutOrNetwork = errDetail.includes('Quá thời gian') || errDetail.includes('kết nối') || errDetail.includes('bảo trì') || errDetail.includes('bận');
            const isNotFound = errDetail.includes('Không tìm thấy') || 
                               errDetail.includes('chưa có dữ liệu') ||
                               errDetail.includes('chưa có') ||
                               errDetail.includes('không tồn tại') ||
                               isCargo ||
                               isTimeoutOrNetwork;

            if (isNotFound) {
              out[code] = {
                carrier,
                statusCategory: 'not_scanned',
                rawStatusText: `Chờ ${carrier === 'jt' ? (isCargo ? 'J&T Cargo' : 'J&T Express') : carrier === 'spx' ? 'SPX' : 'bưu tá'} lấy hàng (Chưa scan)`,
                statusDetail: isTimeoutOrNetwork 
                  ? 'Đang kết nối lại với cổng hãng vận chuyển...' 
                  : 'Mã vận đơn đã tạo trên WMS nhưng chưa có lịch trình quét tiếp nhận trên cổng tra cứu của hãng',
                timeline: [],
                error: undefined
              };
            } else {
              out[code] = {
                carrier,
                statusCategory: 'not_scanned',
                rawStatusText: `Chờ ${carrier === 'jt' ? 'J&T Express' : carrier === 'spx' ? 'SPX' : 'bưu tá'} lấy hàng`,
                statusDetail: errDetail,
                timeline: [],
                error: undefined
              };
            }
          }
        }
        return out;
      }
    }
  } catch (err: any) {
    console.warn('Batch tracking API error, falling back to individual calls', err);
  }

  // Fallback to parallel individual calls
  const out: Record<string, any> = {};
  await Promise.all(
    orders.map(async (o) => {
      try {
        const res = await trackSingleOrder(o.code, o.carrier, o.cellphone, true);
        out[o.code] = res;
      } catch (err: any) {
        out[o.code] = {
          carrier: o.carrier || 'unknown',
          statusCategory: 'not_scanned',
          rawStatusText: 'Chờ quét lại',
          statusDetail: 'Không thể kết nối tạm thời, hệ thống sẽ tự động thử lại',
          timeline: [],
          error: undefined
        };
      }
    })
  );
  return out;
}

/**
 * Creates OrderItem with default pending state
 */
export function createOrderItem(
  code: string, 
  index: number, 
  extraInfo?: any,
  forcedCarrier?: CarrierId
): OrderItem {
  const clean = code.trim();
  const detected = detectCarrier(clean);
  const carrier = detected !== 'unknown'
    ? detected
    : (forcedCarrier && forcedCarrier !== 'unknown' ? forcedCarrier : 'unknown');
  
  const phone = extraInfo?.customerPhone || extraInfo?.phone || extraInfo?.cellphone || undefined;
  const normalizedExtra = extraInfo ? {
    ...extraInfo,
    customerPhone: phone
  } : undefined;

  const directUrl = getDirectTrackingUrl(carrier, clean, phone);

  return {
    id: `order-${index}-${clean}`,
    trackingCode: clean,
    carrier,
    statusCategory: 'not_scanned',
    rawStatusText: 'Chưa kiểm tra',
    statusDetail: 'Sẵn sàng quét',
    timeline: [],
    isChecking: false,
    directUrl,
    originalRowIndex: index,
    extraInfo: normalizedExtra
  };
}
