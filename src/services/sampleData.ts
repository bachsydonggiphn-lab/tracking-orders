import { CarrierId } from '../types/tracking';

export interface SampleOrderRow {
  code: string;
  carrierHint: CarrierId;
  shopName: string;
  phone: string;
  orderDate: string;
}

// Generate realistic mock carrier codes
export function generateSampleCodes(count: number = 200): SampleOrderRow[] {
  const shops = ['Shop Mẹ & Bé Sài Gòn', 'Thời Trang Hè 2026', 'Mỹ Phẩm Auth Official', 'Gia Dụng Thông Minh HCM', 'Phụ Kiện Điện Thoại Pro', 'Bách Hóa Online 247'];
  const results: SampleOrderRow[] = [];

  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

  // Seed real tracking codes from user's live system
  const realSeeds: SampleOrderRow[] = [
    {
      code: 'SPXVN062371495019',
      carrierHint: 'spx',
      shopName: 'Shopee Mall Official Store',
      phone: '0912345678',
      orderDate: dateStr
    },
    {
      code: 'SPXVN068285466948',
      carrierHint: 'spx',
      shopName: 'Shopee Mall Official Store',
      phone: '0912345678',
      orderDate: dateStr
    },
    {
      code: 'GY8HMEXU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HPK2U',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HRGZU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HRU6U',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HS6HU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HSR6U',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HT7YU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HTGAU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HTH5U',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HV9VU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HVTQU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HWE7U',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HWEEU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HWXDU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HX2AU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HX6TU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8HX8YU',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang BDG',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: '862293530154',
      carrierHint: 'jt',
      shopName: 'ĐGP Bình Dương Hub Shop',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8X37DK',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang Thủ Dầu Một',
      phone: '0988008036',
      orderDate: dateStr
    },
    {
      code: '862223810444',
      carrierHint: 'jt',
      shopName: 'ĐGP Bình Dương Hub Shop',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: '862206170444',
      carrierHint: 'jt',
      shopName: 'ĐGP Bình Dương Hub Shop',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: '862282300444',
      carrierHint: 'jt',
      shopName: 'ĐGP Bình Dương Hub Shop',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: '862259491317',
      carrierHint: 'jt',
      shopName: 'ĐGP Bình Dương Hub Shop',
      phone: '0909888036',
      orderDate: dateStr
    },
    {
      code: 'GY8DEU6M',
      carrierHint: 'ghn',
      shopName: 'Shop Thời Trang Thủ Dầu Một',
      phone: '0988008036',
      orderDate: dateStr
    },
    {
      code: 'SPXVN068285466948',
      carrierHint: 'spx',
      shopName: 'Shopee Mall Official Store',
      phone: '0912345678',
      orderDate: dateStr
    }
  ];

  results.push(...realSeeds.slice(0, count));

  for (let i = results.length + 1; i <= count; i++) {
    const shop = shops[i % shops.length];
    const phone = `09${Math.floor(1000 + Math.random() * 9000)}8036`;
    const roll = i % 4;

    let code = '';
    let carrierHint: CarrierId = 'ghn';

    if (roll === 0) {
      // GHN (GY... or G8...)
      const prefix = i % 2 === 0 ? 'GY' : 'G8';
      const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
      code = `${prefix}${randomPart}${i.toString().padStart(2, '0')}`;
      carrierHint = 'ghn';
    } else if (roll === 1) {
      // SPX (Shopee Express: SPXVN...)
      const randomNum = Math.floor(100000000000 + Math.random() * 900000000000);
      code = `SPXVN0${randomNum.toString().slice(0, 11)}`;
      carrierHint = 'spx';
    } else if (roll === 2) {
      // J&T Express (8622... or 84...)
      const prefix = i % 2 === 0 ? '8622' : '8415';
      const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
      code = `${prefix}${suffix}`;
      carrierHint = 'jt';
    } else {
      // Viettel Post (VT...) or Ninja Van (NIVN...)
      if (i % 2 === 0) {
        code = `VT${Math.floor(100000000 + Math.random() * 900000000)}`;
        carrierHint = 'viettelpost';
      } else {
        code = `NIVN${Math.floor(100000000 + Math.random() * 900000000)}`;
        carrierHint = 'ninjavan';
      }
    }

    results.push({
      code,
      carrierHint,
      shopName: shop,
      phone,
      orderDate: dateStr
    });
  }

  return results;
}

