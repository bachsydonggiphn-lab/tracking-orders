export type CarrierType = 'GHN' | 'SPX' | 'JNT' | 'BEST' | 'UNKNOWN';

export interface ScanEvent {
  scannedAt: string;
  scannedBy: string;
  stationId: string;
  notes?: string;
}

export interface CarrierLog {
  status: string;
  location: string;
  timestamp: string;
  description: string;
}

/**
 * Trạng thái theo dõi đơn giản (3 trạng thái):
 * - PICKED_YES:  Shipper đã lấy hàng (Đã đi)
 * - PICKED_NO:   Chưa lấy hàng (Chưa đi)
 * - CANCELLED:   Đơn bị hủy
 */
export type PickupStatus = 'PICKED_YES' | 'PICKED_NO' | 'CANCELLED';

/**
 * @deprecated Giữ lại để tương thích với code cũ
 */
export type ReconciliationStatus =
  | 'COMPLETED'
  | 'CARRIER_RECEIVED'
  | 'WAITING_CARRIER_PICKUP'
  | 'MISSING_NOT_PACKED';

export interface Order {
  id: string;
  trackingNumber: string;
  carrier: CarrierType;
  orderDate: string;
  seller: string;
  warehouse: string;
  warehouseCode?: string; // VN01, VN02, etc.

  // === 3 TRẠNG THÁI ĐƠN GIẢN ===
  pickupStatus: PickupStatus;             // YES / NO / HỦY
  pickupCheckedTime?: string;            // Lần cuối kiểm tra API
  pickupLatestCarrierStatus?: string;    // Status text từ hãng
  pickupLocation?: string;               // Vị trí cuối từ hãng

  // Lịch sử tracking hãng vận chuyển
  carrierScanHistory: CarrierLog[];

  // === KHO QUÉ (giữ lại cho tương thích cũ) ===
  employeeScanned: boolean;
  employeeScanTime?: string;
  employeeName?: string;
  scanStationId?: string;
  employeeScanHistory: ScanEvent[];

  // Carrier Scanning (giữ lại để tương thích)
  carrierScanned: boolean;
  carrierScanTime?: string;
  carrierLatestStatus?: string;
  carrierCurrentLocation?: string;
  carrierLastCheckedTime?: string;

  // Overall Status (giữ lại để tương thích)
  reconciliationStatus: ReconciliationStatus;

  // Products
  products?: { barcode: string; quantity: number }[];

  // Timestamps
  createdTime: string;
  updatedTime: string;
}

export interface SystemSettings {
  syncIntervalSeconds: number;
  missingAlertThresholdMinutes: number;
  telegramBotToken: string;
  telegramChatId: string;
  wmsUrl: string;
  wmsUsername: string;
  wmsPassword?: string;
  enableSoundEffects: boolean;
  targetWarehouse?: string; // VN01 or VN02
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'WMS_SYNC' | 'CARRIER_CHECK' | 'ALERT_TRIGGERED';
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  message: string;
  details?: string;
}

export interface DashboardStats {
  todayOrders: number;
  employeeScannedCount: number;
  carrierScannedCount: number;
  waitingPickupCount: number;
  potentialMissingCount: number;
  completionRate: number;
  lastSyncTime: string;
  isSyncing: boolean;
  // === 3 TRẠNG THÁI ===
  pickedYesCount: number;
  pickedNoCount: number;
  cancelledCount: number;
}
