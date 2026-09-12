import * as XLSX from 'xlsx';
import { CARRIERS } from './carrierDetector';
import { OrderItem, TrackingStatusCategory } from '../types/tracking';
import { getOrderAgeInfo } from '../utils/dateFilter';

export function getStatusLabel(category: TrackingStatusCategory, rawText?: string): string {
  const lower = (rawText || '').toLowerCase();
  if (category === 'not_scanned') {
    if (lower.includes('không thành công') || lower.includes('hẹn lại') || lower.includes('chưa lấy được')) {
      return 'CHƯA SCAN (HẸN LẤY LẠI / LẤY THẤT BẠI)';
    }
    if (lower.includes('kiện vấn đề') || lower.includes('kiện khó')) {
      return 'CHƯA SCAN (KIỆN VẤN ĐỀ / KIỆN KHÓ)';
    }
    return 'CHƯA SCAN (CHỜ LẤY)';
  }
  if (category === 'in_transit') {
    if (lower.includes('không thành công') || lower.includes('hẹn giao lại')) {
      return 'ĐÃ SCAN (GIAO THẤT BẠI - HẸN LẠI)';
    }
    if (lower.includes('đang giao') || lower.includes('sớm được giao') || lower.includes('trạm giao hàng') || lower.includes('đến trạm') || lower.includes('sắp xếp tài xế')) {
      return 'ĐÃ SCAN (ĐANG GIAO HÀNG)';
    }
    return 'ĐÃ SCAN (TRUNG CHUYỂN)';
  }
  switch (category) {
    case 'scanned': return 'ĐÃ SCAN (VỪA LẤY HÀNG)';
    case 'cancelled': return 'ĐÃ HỦY (CẦN GIỮ LẠI ĐƠN)';
    case 'delivered': return 'ĐÃ SCAN (GIAO THÀNH CÔNG)';
    case 'returned': return 'CHUYỂN HOÀN';
    case 'error': return 'LỖI TRA CỨU';
    default: return 'CHƯA RÕ';
  }
}

/**
 * Exports orders list to modern Excel (.xlsx) file
 */
export function exportOrdersToExcel(
  orders: OrderItem[], 
  filename: string = 'Bao_Cao_Trang_Thai_Don_Hang.xlsx'
) {
  const data = orders.map((order, idx) => {
    const ageInfo = getOrderAgeInfo(order);
    return {
      'STT': idx + 1,
      'Mã Vận Đơn': order.trackingCode,
      'Đơn Vị Vận Chuyển': CARRIERS[order.carrier]?.name || order.carrier,
      'Trạng Thái Phân Loại': getStatusLabel(order.statusCategory, order.rawStatusText),
      'Tuổi Đơn Hàng': ageInfo.label,
      'Ghi Chú Đóng Gói/Scan': order.statusCategory === 'not_scanned' ? ageInfo.description : '',
      'Chi Tiết Trạng Thái': order.rawStatusText,
      'Mô Tả Quá Trình': order.statusDetail || '',
      'Thời Gian Quét Lấy': order.scannedAt || 'Chưa có',
      'Thời Gian Cập Nhật Mới Nhất': order.updatedAt || order.scannedAt || 'Chưa có',
      'Order No (WMS)': order.orderNo || '',
      'Ref No (WMS)': order.refNo || '',
      'Kho Hàng (WMS)': order.warehouseName || '',
      'Tên Shop / Nguồn': order.extraInfo?.shopName || '',
      'SĐT Khách': order.extraInfo?.customerPhone || '',
      'Link Tra Cứu Trực Tiếp': order.directUrl
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column widths for comfortable viewing in Excel
  worksheet['!cols'] = [
    { wch: 6 },  // STT
    { wch: 22 }, // Mã Vận Đơn
    { wch: 24 }, // Hãng
    { wch: 22 }, // Trạng Thái
    { wch: 16 }, // Tuổi Đơn
    { wch: 32 }, // Ghi Chú Đóng Gói
    { wch: 38 }, // Chi Tiết
    { wch: 45 }, // Mô Tả
    { wch: 22 }, // Thời Gian
    { wch: 20 }, // Order No
    { wch: 20 }, // Ref No
    { wch: 16 }, // Kho Hàng
    { wch: 20 }, // Tên Shop
    { wch: 14 }, // SĐT
    { wch: 45 }, // Link
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Trạng Thái Vận Đơn');

  XLSX.writeFile(workbook, filename);
}

/**
 * Exports plain CSV text file
 */
export function exportOrdersToCSV(orders: OrderItem[], filename: string = 'danh_sach_van_don.csv') {
  const headers = ['STT', 'Ma_Van_Don', 'Hang_Van_Chuyen', 'Trang_Thai', 'Tuoi_Don_Hang', 'Chi_Tiet', 'Thoi_Gian_Scan', 'Link_Tra_Cuu'];
  const rows = orders.map((o, idx) => {
    const ageInfo = getOrderAgeInfo(o);
    return [
      idx + 1,
      `"${o.trackingCode}"`,
      `"${CARRIERS[o.carrier]?.shortName || o.carrier}"`,
      `"${getStatusLabel(o.statusCategory)}"`,
      `"${ageInfo.label}"`,
      `"${o.rawStatusText.replace(/"/g, '""')}"`,
      `"${o.scannedAt || ''}"`,
      `"${o.directUrl}"`
    ];
  });

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies a list of tracking codes to clipboard
 */
export async function copyCodesToClipboard(orders: OrderItem[], delimiter: string = '\n'): Promise<boolean> {
  try {
    const text = orders.map(o => o.trackingCode).join(delimiter);
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

/**
 * Exports full orders list as clean JSON file for backup and F5 state restoration
 */
export function exportOrdersToJSON(orders: OrderItem[], filename: string = 'trang_thai_van_don.json') {
  const payload = {
    exportedAt: new Date().toISOString(),
    total: orders.length,
    orders
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

