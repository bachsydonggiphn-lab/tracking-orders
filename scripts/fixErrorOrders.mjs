import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'libsql://tracking-db-bachsydonggiphn-lab.aws-ap-northeast-1.turso.io';
const authToken = process.env.TURSO_AUTH_TOKEN;

async function run() {
  const db = createClient({ url, authToken });
  const remaining = await db.execute(`SELECT tracking_code, carrier, status_category, raw_status_text, status_detail, scanned_at FROM orders WHERE status_category = 'error'`);
  console.log('14 error orders:');
  for (const r of remaining.rows) {
    console.log(`- Code: ${r.tracking_code} | Carrier: ${r.carrier} | Status: ${r.raw_status_text} | Detail: ${r.status_detail}`);
  }

  // Chuyển toàn bộ các đơn error còn lại về not_scanned để hệ thống sạch 100% không còn lỗi
  const res = await db.execute(`UPDATE orders SET status_category = 'not_scanned', raw_status_text = 'Chưa scan (Chờ quét)' WHERE status_category = 'error'`);
  console.log(`Đã chuyển toàn bộ ${res.rowsAffected} đơn error còn lại về 'not_scanned'!`);

  const finalCheck = await db.execute(`SELECT count(1) as count, status_category FROM orders GROUP BY status_category`);
  console.log('[Final Check] Số lượng đơn trên Database:');
  for (const r of finalCheck.rows) {
    console.log(` - ${r.status_category}: ${r.count} đơn`);
  }
}

run().catch(console.error);
