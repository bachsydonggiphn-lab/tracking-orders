export type CarrierId = 'ghn' | 'spx' | 'jt' | 'viettelpost' | 'ninjavan' | 'vnpost' | 'best' | 'unknown';

export type TrackingStatusCategory = 
  | 'scanned'       // Đã scan / Đã lấy hàng / Đang xử lý tại kho
  | 'not_scanned'   // Chưa scan / Chờ lấy hàng / Mới tạo vận đơn
  | 'cancelled'     // Đã hủy / Hủy lấy hàng
  | 'in_transit'    // Đang vận chuyển / Đang giao hàng
  | 'delivered'     // Giao hàng thành công
  | 'returned'      // Hoàn hàng / Chuyển hoàn
  | 'error';        // Sai mã / Không tìm thấy / Lỗi kết nối

export interface TrackingEvent {
  time: string;
  statusText: string;
  location?: string;
  description?: string;
}

export interface OrderItem {
  id: string;
  trackingCode: string;
  carrier: CarrierId;
  statusCategory: TrackingStatusCategory;
  rawStatusText: string;
  statusDetail?: string;
  scannedAt?: string;
  updatedAt?: string;
  pickupAddress?: string;
  recipientLocation?: string;
  weight?: string;
  codAmount?: number;
  timeline: TrackingEvent[];
  isChecking: boolean;
  error?: string;
  directUrl: string;
  originalRowIndex?: number;
  orderNo?: string;
  refNo?: string;
  customerCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  platformOrderNo?: string;
  carrierChannel?: string;
  wmsStatus?: string;
  source?: 'yunwms' | 'excel' | 'manual';
  extraInfo?: {
    shopName?: string;
    customerPhone?: string;
    orderDate?: string;
    platform?: string;
  };
}

export interface YunWMSSyncOptions {
  pageSize: number;
  dateInterval?: string; // "3", "7", "30", ""
  warehouseId?: string;  // "7" (VN02), "4" (VN01), "" (All)
  customerCode?: string; // "YD", etc.
  orderStatus?: string;  // "4" (submitted), "8" (shipped), etc.
  autoTrack: boolean;
}

export interface CarrierConfig {
  id: CarrierId;
  name: string;
  shortName: string;
  logoColor: string;
  badgeBg: string;
  badgeText: string;
  prefixHints: string[];
  trackingUrlPattern: string;
  website: string;
}

export interface BatchStats {
  total: number;
  checked: number;
  scanned: number;
  notScanned: number;
  unscanned1Day: number;      // Đơn 1 ngày tuổi chờ scan
  unscanned2Days: number;     // Đơn 2 ngày tuổi chờ scan
  unscanned3PlusDays: number; // Đơn ≥ 3 ngày tuổi chờ scan
  cancelled: number;
  inTransit: number;
  delivered: number;
  returned: number;
  error: number;
  percentComplete: number;
  scannedRate: number;
}

export interface TrackingProgressMetrics {
  startTime: number;
  total: number;
  completed: number;
  percent: number;
  speed: number; // items per second
  estimatedSecondsLeft: number;
  etaFormatted: string;
}
