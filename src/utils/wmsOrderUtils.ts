/**
 * Reusable YunWMS order transformation and real-time pulling utilities
 */
import { OrderItem } from '../types/tracking';
import { CARRIERS, detectCarrier, getDirectTrackingUrl, matchesTrackingPrefixFilter, PrefixFilterConfig } from '../services/carrierDetector';

export interface ConvertWMSOptions extends PrefixFilterConfig {
  excludeToday?: boolean;
  warehouseId?: string;
}

export function convertRawWmsToOrderItems(
  rawOrders: any[],
  options: ConvertWMSOptions = {}
): OrderItem[] {
  const {
    carrierFilterMode = 'spx_jt',
    selectedCarriers = [],
    customPrefixes = [],
    excludeToday = false,
    warehouseId = '7'
  } = options;

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

    // 2. Chỉ kéo trạng thái shipper -1 ngày nếu excludeToday = true
    if (excludeToday) {
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
      source: 'yunwms' as const,
      extraInfo: {
        shopName: item.customerCode ? `Khách: ${item.customerCode}` : wmsWarehouseName,
        orderDate: item.createDate,
        platform: item.carrierChannel || 'WMS'
      }
    };
  });
}

/**
 * Fetch latest real-time Shipper (status 8) orders from YunWMS
 */
export async function fetchLatestWMSOrders(pageSize: number = 100): Promise<OrderItem[]> {
  let userName = 'David';
  let userPass = '12345abc';
  let warehouseId = '7';
  let carrierFilterMode: 'spx_jt' | 'all' | 'custom' = 'spx_jt';
  let selectedCarriers: string[] = ['spx', 'jt', 'jt_cargo'];
  let customPrefixes: string[] = [];

  try {
    const u = localStorage.getItem('yunwms_username');
    const p = localStorage.getItem('yunwms_password');
    const w = localStorage.getItem('yunwms_warehouse_id');
    const m = localStorage.getItem('yunwms_carrier_filter_mode') as any;
    const sc = localStorage.getItem('yunwms_selected_carriers');
    const cp = localStorage.getItem('yunwms_custom_prefixes');

    if (u) userName = u;
    if (p) userPass = p;
    if (w) warehouseId = w;
    if (m) carrierFilterMode = m;
    if (sc) selectedCarriers = JSON.parse(sc);
    if (cp) customPrefixes = JSON.parse(cp);
  } catch {}

  const response = await fetch('/api/yunwms/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userName,
      userPass,
      page: 1,
      pageSize,
      dateInterval: '', // Empty pulls the latest orders descending in real-time
      orderStatus: '8', // Shipper (Đã xuất kho)
      warehouseId,
      excludeToday: false, // Quét thời gian thực không trừ ngày
      carrierFilterMode,
      selectedCarriers,
      customPrefixes
    })
  });

  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Không thể kéo đơn từ YunWMS');
  }

  return convertRawWmsToOrderItems(data.orders || [], {
    carrierFilterMode,
    selectedCarriers,
    customPrefixes,
    excludeToday: false,
    warehouseId
  });
}
