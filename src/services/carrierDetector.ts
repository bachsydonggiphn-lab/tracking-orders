import { CarrierConfig, CarrierId } from '../types/tracking';

export const CARRIERS: Record<CarrierId, CarrierConfig> = {
  ghn: {
    id: 'ghn',
    name: 'Giao Hàng Nhanh (GHN)',
    shortName: 'GHN',
    logoColor: '#F26522',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    badgeText: 'text-orange-600',
    prefixHints: ['VNGH', 'GY', 'G8', 'NL', 'GHN'],
    trackingUrlPattern: 'https://donhang.ghn.vn/?order_code={CODE}',
    website: 'https://donhang.ghn.vn/'
  },
  spx: {
    id: 'spx',
    name: 'Shopee Express (SPX)',
    shortName: 'SPX',
    logoColor: '#EE4D2D',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    badgeText: 'text-red-600',
    prefixHints: ['SPXVN', 'SPX', 'VNSPX', 'SPE', 'VNSP'],
    trackingUrlPattern: 'https://spx.vn/track?{CODE}',
    website: 'https://spx.vn/vi'
  },
  jt: {
    id: 'jt',
    name: 'J&T Express',
    shortName: 'J&T Express',
    logoColor: '#E60012',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeText: 'text-rose-600',
    prefixHints: ['832', '86', '84', '83', 'JT', 'JTE', 'JTT'],
    trackingUrlPattern: 'https://jtexpress.vn/vi/tracking?type=track&billcode={CODE}',
    website: 'https://jtexpress.vn/'
  },
  jt_cargo: {
    id: 'jt_cargo',
    name: 'J&T (Cargo)',
    shortName: 'J&T (Cargo)',
    logoColor: '#D97706',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-300',
    badgeText: 'text-amber-700',
    prefixHints: ['530', '53'],
    trackingUrlPattern: 'https://office.jtcargo.com.vn/trade/orderQuery?bills={CODE}',
    website: 'https://jtcargo.com.vn/'
  },
  viettelpost: {
    id: 'viettelpost',
    name: 'Viettel Post',
    shortName: 'VTP',
    logoColor: '#EE0033',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeText: 'text-emerald-600',
    prefixHints: ['VT', 'VTP', 'SHOPEEVTP', '10', '11', '12', '13', '14', '15'],
    trackingUrlPattern: 'https://viettelpost.com.vn/tra-cuu-hanh-trinh-don/?order_number={CODE}',
    website: 'https://viettelpost.com.vn/'
  },
  ninjavan: {
    id: 'ninjavan',
    name: 'Ninja Van',
    shortName: 'NinjaVan',
    logoColor: '#C41230',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    badgeText: 'text-purple-600',
    prefixHints: ['NIVN', 'SHP', 'NLVN', 'NV'],
    trackingUrlPattern: 'https://www.ninjavan.co/vi-vn/tracking?id={CODE}',
    website: 'https://www.ninjavan.co/vi-vn/'
  },
  vnpost: {
    id: 'vnpost',
    name: 'Bưu điện Việt Nam (VNPost / EMS)',
    shortName: 'VNPost',
    logoColor: '#FFB600',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    badgeText: 'text-amber-700',
    prefixHints: ['EVN', 'CVN', 'RVN', 'VNPOST', 'EMS'],
    trackingUrlPattern: 'https://ems.com.vn/tra-cuu/tra-cuu-buu-gui?code={CODE}',
    website: 'https://ems.com.vn/'
  },
  best: {
    id: 'best',
    name: 'Best Express',
    shortName: 'Best Express',
    logoColor: '#0055A5',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeText: 'text-blue-600',
    prefixHints: ['TTVN', '61', '81', 'BEST'],
    trackingUrlPattern: 'https://best-inc.vn/track?bills={CODE}',
    website: 'https://best-inc.vn/'
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok Shop Logistics',
    shortName: 'TikTok Shop',
    logoColor: '#000000',
    badgeBg: 'bg-zinc-100 text-zinc-900 border-zinc-300',
    badgeText: 'text-zinc-900',
    prefixHints: ['TT'],
    trackingUrlPattern: 'https://seller-vn.tiktok.com/',
    website: 'https://seller-vn.tiktok.com/'
  },
  lex: {
    id: 'lex',
    name: 'Lazada Express (LEX)',
    shortName: 'Lazada LEX',
    logoColor: '#0F146D',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    badgeText: 'text-indigo-600',
    prefixHints: ['LEX', 'LEXTH', 'LEXVN'],
    trackingUrlPattern: 'https://tracker.lel.asia/tracker?tracking_number={CODE}',
    website: 'https://tracker.lel.asia/'
  },
  ghtk: {
    id: 'ghtk',
    name: 'Giao Hàng Tiết Kiệm (GHTK)',
    shortName: 'GHTK',
    logoColor: '#006A32',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    badgeText: 'text-emerald-700',
    prefixHints: ['S', 'GHTK'],
    trackingUrlPattern: 'https://i.ghtk.vn/{CODE}',
    website: 'https://i.ghtk.vn/'
  },
  unknown: {
    id: 'unknown',
    name: 'Chưa xác định hãng',
    shortName: 'Khác',
    logoColor: '#6B7280',
    badgeBg: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    badgeText: 'text-zinc-500',
    prefixHints: [],
    trackingUrlPattern: 'https://www.google.com/search?q={CODE}',
    website: ''
  }
};

/**
 * Automatically detects carrier by tracking code format, prefixes, and optional channel hint
 */
export function detectCarrier(code: string, channelHint: string = ''): CarrierId {
  const cleanCode = (code || '').trim().toUpperCase();
  const cleanChannel = (channelHint || '').trim().toUpperCase();

  // 1. PRIMARY RULE: Direct Tracking Number Prefix / Format Check (Highest Priority & Absolute Truth)
  // Shopee Express (SPX): Starts with SPXVN, SPX, VNSPX, SPE, VNSP, or Shopee Crossborder VN2...
  if (
    cleanCode.startsWith('SPXVN') || 
    cleanCode.startsWith('SPX') || 
    cleanCode.startsWith('VNSPX') || 
    cleanCode.startsWith('SPE') ||
    cleanCode.startsWith('VNSP') ||
    (cleanCode.startsWith('VN2') && cleanCode.length >= 13 && /^[A-Z0-9]+$/.test(cleanCode) && !cleanCode.endsWith('VN'))
  ) {
    return 'spx';
  }

  // J&T Cargo: Starts with 530 or (53 + 11-13 digits)
  if (
    cleanCode.startsWith('530') || 
    ((cleanCode.startsWith('53')) && cleanCode.length >= 11 && cleanCode.length <= 13 && /^\d+$/.test(cleanCode))
  ) {
    return 'jt_cargo';
  }

  // J&T Express: Starts with 8, JT, JTE, JTT, JNT
  if (
    cleanCode.startsWith('8') ||
    cleanCode.startsWith('JT') || 
    cleanCode.startsWith('JTE') || 
    cleanCode.startsWith('JTT') || 
    cleanCode.startsWith('JNT')
  ) {
    return 'jt';
  }

  // Best Express: Starts with TTVN (TikTok Shop / TMĐT), BEST, or 12 digits starting with 61 or 81
  if (
    cleanCode.startsWith('TTVN') ||
    cleanCode.startsWith('BEST') ||
    ((cleanCode.startsWith('61') || cleanCode.startsWith('81')) && cleanCode.length === 12 && /^\d+$/.test(cleanCode))
  ) {
    return 'best';
  }

  // TikTok Shop Logistics: Other TT codes (when not starting with TTVN)
  if (!cleanCode.startsWith('TTVN') && cleanCode.startsWith('TT') && cleanCode.length >= 12) {
    return 'tiktok';
  }

  // Lazada Express (LEX): Starts with LEX, LEXTH, LEXVN
  if (cleanCode.startsWith('LEX') || cleanCode.startsWith('LEXTH') || cleanCode.startsWith('LEXVN')) {
    return 'lex';
  }

  // Giao Hàng Tiết Kiệm (GHTK): Starts with GHTK or S + 8-10 digits
  if (cleanCode.startsWith('GHTK') || (cleanCode.startsWith('S') && cleanCode.length >= 9 && cleanCode.length <= 11 && /^\d+$/.test(cleanCode.slice(1)))) {
    return 'ghtk';
  }

  // Giao Hàng Nhanh (GHN): Starts with VNGH, GY, G8, GHN, NL_, or 8-char alphanumeric
  if (
    cleanCode.startsWith('VNGH') ||
    cleanCode.startsWith('GY') || 
    cleanCode.startsWith('G8') || 
    cleanCode.startsWith('GHN') ||
    cleanCode.startsWith('NL_') ||
    (cleanCode.length === 8 && /^[A-Z0-9]{8}$/.test(cleanCode) && (cleanCode.startsWith('G') || cleanChannel.includes('GHN')))
  ) {
    return 'ghn';
  }

  // Ninja Van: Starts with NIVN, NLVN, NV, or SHP (when length > 10)
  if (
    cleanCode.startsWith('NIVN') || 
    cleanCode.startsWith('NLVN') || 
    cleanCode.startsWith('NV') ||
    (cleanCode.startsWith('SHP') && cleanCode.length > 10)
  ) {
    return 'ninjavan';
  }

  // Viettel Post (VTP): Starts with VT, VTP or SHOPEEVTP
  if (
    cleanCode.startsWith('VT') || 
    cleanCode.startsWith('VTP') ||
    cleanCode.startsWith('SHOPEEVTP')
  ) {
    return 'viettelpost';
  }

  // VNPost / EMS: Starts with EMS, VNPOST, or standard UPU /^[A-Z]{2}\d{8,11}VN$/i
  if (
    cleanCode.startsWith('EMS') || 
    cleanCode.startsWith('VNPOST') ||
    /^[A-Z]{2}\d{8,11}VN$/i.test(cleanCode) ||
    /^[ECRV][A-Z0-9]{8,11}VN$/i.test(cleanCode)
  ) {
    return 'vnpost';
  }

  // 2. Fallback heuristics based on pure numeric code length
  if (/^\d{12}$/.test(cleanCode)) {
    if (cleanCode.startsWith('53')) return 'jt_cargo';
    if (cleanCode.startsWith('61') || cleanCode.startsWith('81')) return 'best';
    return 'jt';
  }

  if (/^\d{9,11}$/.test(cleanCode)) {
    return 'viettelpost';
  }

  // 3. SECONDARY RULE: Check explicit channel hints only if tracking code did not match standard carrier formats
  if (cleanChannel) {
    if (cleanChannel.includes('CARGO')) {
      return 'jt_cargo';
    }
    if (cleanChannel.includes('LEX') || cleanChannel.includes('LAZADA')) {
      return 'lex';
    }
    if (cleanChannel.includes('TIKTOK') || cleanChannel.includes('TTVN')) {
      return 'tiktok';
    }
    if (cleanChannel.includes('GHTK') || cleanChannel.includes('TIET KIEM')) {
      return 'ghtk';
    }
    if (cleanChannel.includes('GHN') || cleanChannel.includes('GIAOHANGNHANH') || cleanChannel.includes('GIAO HANG NHANH')) {
      return 'ghn';
    }
    if (cleanChannel.includes('SPX') || cleanChannel.includes('SHOPEE') || cleanChannel.includes('SPE')) {
      return 'spx';
    }
    if (
      cleanChannel.includes('J&T') || 
      cleanChannel.includes('JNT') || 
      cleanChannel.includes('JTEXPRESS')
    ) {
      return 'jt';
    }
    if (cleanChannel.includes('VIETTEL') || cleanChannel.includes('VTP')) {
      return 'viettelpost';
    }
    if (cleanChannel.includes('NINJA') || cleanChannel.includes('NIVN')) {
      return 'ninjavan';
    }
    if (cleanChannel.includes('VNPOST') || cleanChannel.includes('EMS') || cleanChannel.includes('BUUDIEN')) {
      return 'vnpost';
    }
    if (cleanChannel.includes('BEST')) {
      return 'best';
    }
  }

  return 'unknown';
}

/**
 * Generates direct tracking link to carrier's official website
 */
export function getDirectTrackingUrl(carrier: CarrierId, code: string, phone: string = ''): string {
  const config = CARRIERS[carrier] || CARRIERS.unknown;
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return config.website || 'https://spx.vn/vi';
  }
  if (carrier === 'spx' || cleanCode.startsWith('SPXVN') || cleanCode.startsWith('SPX')) {
    return `https://spx.vn/track?${encodeURIComponent(cleanCode)}`;
  }
  if (carrier === 'jt_cargo' || cleanCode.startsWith('530') || (cleanCode.startsWith('53') && cleanCode.length >= 11)) {
    return `https://office.jtcargo.com.vn/trade/orderQuery?bills=${encodeURIComponent(cleanCode)}`;
  }
  let url = config.trackingUrlPattern.replace('{CODE}', encodeURIComponent(cleanCode));
  if (carrier === 'jt') {
    const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-4) : '8836';
    if (cleanPhone) {
      url += `&cellphone=${encodeURIComponent(cleanPhone)}`;
    }
  }
  return url;
}

/**
 * Generates official J&T Express multi-tracking URL for up to 10 bill codes in 1 query
 * Format: https://jtexpress.vn/vi/tracking?type=track&billcode=code1,code2,...&cellphone=8836
 */
export function getJNTMultiTrackingUrl(codes: string[], phone: string = '8836'): string {
  const cleanCodes = codes.map(c => c.trim().toUpperCase()).filter(Boolean).slice(0, 10);
  const cleanPhone = phone ? phone.replace(/\D/g, '').slice(-4) : '8836';
  return `https://jtexpress.vn/vi/tracking?type=track&billcode=${encodeURIComponent(cleanCodes.join(','))}&cellphone=${encodeURIComponent(cleanPhone)}`;
}

// ---------------------------------------------------------------------------
// TỪ ĐIỂN ĐẦU MÃ VẬN ĐƠN ĐÃ HỌC TỪ 179.000+ ĐƠN HÀNG THỰC TẾ TRÊN YUNWMS
// ---------------------------------------------------------------------------
export interface HistoricalCarrierDefinition {
  id: string;
  carrierId: CarrierId;
  name: string;
  shortName: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  prefixes: string[];
  description: string;
  samples: string[];
  historicalShare: string;
  estimatedCount: string;
  isCoreWarehouse: boolean; // Kênh cốt lõi kho VN02
  matchFn: (code: string) => boolean;
}

export const HISTORICAL_CARRIER_PREFIXES: HistoricalCarrierDefinition[] = [
  {
    id: 'spx',
    carrierId: 'spx',
    name: 'Shopee Express (SPX)',
    shortName: 'SPX Express',
    badgeBg: 'bg-red-50 text-red-700',
    badgeText: 'text-red-600',
    borderColor: 'border-red-300',
    prefixes: ['SPXVN', 'SPX', 'VNSPX', 'SPE'],
    description: 'Shopee Express nội địa & xuyên biên giới. Chiếm đa số đơn hàng kho.',
    samples: ['SPXVN062390400939', 'SPXVN069617599739'],
    historicalShare: '~66%',
    estimatedCount: '~118.000+ đơn',
    isCoreWarehouse: true,
    matchFn: (c: string) => c.startsWith('SPXVN') || c.startsWith('SPX') || c.startsWith('VNSPX') || c.startsWith('SPE')
  },
  {
    id: 'jt',
    carrierId: 'jt',
    name: 'J&T Express (Tiêu Chuẩn)',
    shortName: 'J&T (Đầu 8)',
    badgeBg: 'bg-rose-50 text-rose-700',
    badgeText: 'text-rose-600',
    borderColor: 'border-rose-300',
    prefixes: ['8...', '8623', '84', '83', 'JT', 'JNT'],
    description: 'J&T Express Shopee, TikTok Shop, ngoài sàn. Mã 12 số bắt đầu bằng 8.',
    samples: ['862350452337', '862359057088', '862335170133'],
    historicalShare: '~19%',
    estimatedCount: '~34.000+ đơn',
    isCoreWarehouse: true,
    matchFn: (c: string) => c.startsWith('8') || c.startsWith('JT') || c.startsWith('JNT') || c.startsWith('JTE') || c.startsWith('JTT') || (/^\d{12}$/.test(c) && !c.startsWith('53'))
  },
  {
    id: 'jt_cargo',
    carrierId: 'jt',
    name: 'J&T Cargo (Hàng Nặng / Cồng Kềnh)',
    shortName: 'J&T Cargo (Đầu 53)',
    badgeBg: 'bg-amber-50 text-amber-800',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-300',
    prefixes: ['53...', '5306', '5307'],
    description: 'J&T Cargo chuyên tuyến hàng cồng kềnh, kiện to. Mã 12 số bắt đầu bằng 53.',
    samples: ['530682360208', '530780930208'],
    historicalShare: '~0.5%',
    estimatedCount: '~900+ đơn',
    isCoreWarehouse: true,
    matchFn: (c: string) => c.startsWith('530') || (c.startsWith('53') && /^\d{11,13}$/.test(c))
  },
  {
    id: 'ghn',
    carrierId: 'ghn',
    name: 'Giao Hàng Nhanh (GHN & TMĐT)',
    shortName: 'GHN (VNGH/GY)',
    badgeBg: 'bg-orange-50 text-orange-700',
    badgeText: 'text-orange-600',
    borderColor: 'border-orange-300',
    prefixes: ['VNGH', 'GHN', 'GYY...', 'GY8...', 'GYA...'],
    description: 'GHN truyền thống (VNGH) & mã kênh TMĐT liên kết GHN (8 ký tự GYY, GY8, GYA).',
    samples: ['VNGH80148629202', 'GYY3XU88', 'GY8H6K7D', 'GYA36XH8'],
    historicalShare: '~14%',
    estimatedCount: '~25.000+ đơn',
    isCoreWarehouse: false,
    matchFn: (c: string) => c.startsWith('VNGH') || c.startsWith('GHN') || c.startsWith('G8') || c.startsWith('NL_') || (c.length === 8 && /^[A-Z0-9]{8}$/.test(c) && c.startsWith('G')) || c.startsWith('GYY') || c.startsWith('GY8') || c.startsWith('GYA')
  },
  {
    id: 'viettelpost',
    carrierId: 'viettelpost',
    name: 'Viettel Post',
    shortName: 'Viettel Post',
    badgeBg: 'bg-emerald-50 text-emerald-700',
    badgeText: 'text-emerald-600',
    borderColor: 'border-emerald-300',
    prefixes: ['SHOPEEVTP', 'VT', 'VTP'],
    description: 'Viettel Post nội địa & đơn Shopee chỉ định giao qua Viettel Post.',
    samples: ['SHOPEEVTPVN262117967761D', 'VT1098234812'],
    historicalShare: '~0.2%',
    estimatedCount: '~350+ đơn',
    isCoreWarehouse: false,
    matchFn: (c: string) => c.startsWith('SHOPEEVTP') || c.startsWith('VT') || c.startsWith('VTP') || (/^\d{9,11}$/.test(c))
  },
  {
    id: 'vnpost',
    carrierId: 'vnpost',
    name: 'Bưu điện Việt Nam (VNPost / EMS)',
    shortName: 'VNPost (EA/EB/EMS)',
    badgeBg: 'bg-amber-50 text-amber-800',
    badgeText: 'text-amber-700',
    borderColor: 'border-amber-300',
    prefixes: ['EA...VN', 'EB...VN', 'CO...VN', 'EMS', 'VNPOST'],
    description: 'VNPost chuẩn UPU quốc tế 13 ký tự (EA, EB chuyển phát nhanh EMS, CO bưu kiện).',
    samples: ['EA340865961VN', 'EB343979296VN', 'CO999428106VN'],
    historicalShare: '~2%',
    estimatedCount: '~5.000+ đơn',
    isCoreWarehouse: true,
    matchFn: (c: string) => c.startsWith('EMS') || c.startsWith('VNPOST') || /^[A-Z]{2}\d{8,11}VN$/i.test(c) || /^[ECRV][A-Z0-9]{8,11}VN$/i.test(c)
  },
  {
    id: 'ninjavan',
    carrierId: 'ninjavan',
    name: 'Ninja Van',
    shortName: 'Ninja Van',
    badgeBg: 'bg-purple-50 text-purple-700',
    badgeText: 'text-purple-600',
    borderColor: 'border-purple-300',
    prefixes: ['NIVN', 'NLVN', 'NV', 'SHP'],
    description: 'Ninja Van Việt Nam (Mã NIVN, NLVN hoặc mã Shopee SHP).',
    samples: ['NIVN1098946559'],
    historicalShare: '~0.1%',
    estimatedCount: '~180+ đơn',
    isCoreWarehouse: false,
    matchFn: (c: string) => c.startsWith('NIVN') || c.startsWith('NLVN') || c.startsWith('NV') || (c.startsWith('SHP') && c.length > 10)
  },
  {
    id: 'best',
    carrierId: 'best',
    name: 'Best Express',
    shortName: 'Best Express',
    badgeBg: 'bg-blue-50 text-blue-700',
    badgeText: 'text-blue-600',
    borderColor: 'border-blue-300',
    prefixes: ['TTVN...', '61...', '81...', 'BEST'],
    description: 'Best Express (Mã TTVN... từ TikTok Shop/TMĐT, mã 12 số 61, 81 hoặc chữ BEST).',
    samples: ['TTVN00123456789', '612345678901', 'BEST12345678'],
    historicalShare: '<0.1%',
    estimatedCount: '~50+ đơn',
    isCoreWarehouse: false,
    matchFn: (c: string) => c.startsWith('TTVN') || c.startsWith('BEST') || ((c.startsWith('61') || c.startsWith('81')) && c.length === 12 && /^\d+$/.test(c))
  }
];

export interface PrefixFilterConfig {
  carrierFilterMode?: 'spx_jt' | 'spx_jt_vnpost' | 'all' | 'custom';
  selectedCarriers?: string[]; // e.g. ['spx', 'jt', 'jt_cargo', 'vnpost', 'ghn']
  customPrefixes?: string[];   // e.g. ['8623', 'SPXVN', '530', 'EA']
  only8623AndSpxvn?: boolean;  // legacy parameter support
}

/**
 * Kiểm tra xem 1 mã vận đơn có thỏa mãn bộ lọc tiền tố/hãng vận chuyển được chọn hay không
 */
export function matchesTrackingPrefixFilter(code: string, options: PrefixFilterConfig): boolean {
  const cleanCode = (code || '').trim().toUpperCase();
  if (!cleanCode) return false;

  const mode = options.carrierFilterMode || (options.only8623AndSpxvn ? 'spx_jt' : 'all');

  // Chế độ 1: Tất cả - Kéo toàn bộ không lọc
  if (mode === 'all') {
    return true;
  }

  // Chế độ 2: SPX + J&T + VNPost (Mặc định chuẩn kho VN02)
  if (mode === 'spx_jt' || (mode as string) === 'spx_jt_vnpost') {
    const isSpx = cleanCode.startsWith('SPXVN') || cleanCode.startsWith('SPX') || cleanCode.startsWith('VNSPX') || cleanCode.startsWith('SPE');
    const isJt = cleanCode.startsWith('8') || cleanCode.startsWith('JT') || cleanCode.startsWith('JNT') || cleanCode.startsWith('530') || (cleanCode.startsWith('53') && /^\d{11,13}$/.test(cleanCode));
    const isVnpost = cleanCode.startsWith('EMS') || cleanCode.startsWith('VNPOST') || /^[A-Z]{2}\d{8,11}VN$/i.test(cleanCode) || /^[ECRV][A-Z0-9]{8,11}VN$/i.test(cleanCode);
    return isSpx || isJt || isVnpost;
  }

  // Chế độ 3: Tùy chỉnh (custom)
  // Ưu tiên 1: Kiểm tra các tiền tố tự gõ (customPrefixes)
  if (options.customPrefixes && options.customPrefixes.length > 0) {
    for (const rawPrefix of options.customPrefixes) {
      const pfx = rawPrefix.trim().toUpperCase();
      if (pfx && cleanCode.startsWith(pfx)) {
        return true;
      }
    }
  }

  // Ưu tiên 2: Kiểm tra các hãng được chọn trong danh sách selectedCarriers
  if (options.selectedCarriers && options.selectedCarriers.length > 0) {
    for (const carrierKey of options.selectedCarriers) {
      const def = HISTORICAL_CARRIER_PREFIXES.find(d => d.id === carrierKey);
      if (def && def.matchFn(cleanCode)) {
        return true;
      }
    }
  }

  return false;
}

