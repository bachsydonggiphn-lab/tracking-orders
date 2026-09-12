import { createClient, InStatement } from "@libsql/client";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function migrate() {
  const tursoUrl = (process.env.TURSO_DATABASE_URL || "").trim();
  const tursoToken = (process.env.TURSO_AUTH_TOKEN || "").trim();

  if (!tursoUrl) {
    console.error("❌ LỖI: Chưa cấu hình TURSO_DATABASE_URL trong file .env!");
    console.log("👉 Vui lòng tạo file .env với 2 dòng sau:");
    console.log("TURSO_DATABASE_URL=libsql://ten-database-cua-ban.turso.io");
    console.log("TURSO_AUTH_TOKEN=chuoi-token-cua-ban\n");
    process.exit(1);
  }

  const localDbPath = path.resolve(process.cwd(), "data", "tracking.sqlite");
  if (!fs.existsSync(localDbPath)) {
    console.error("❌ Không tìm thấy file data/tracking.sqlite trên máy!");
    process.exit(1);
  }

  console.log("==================================================");
  console.log("🚀 BẮT ĐẦU ĐỒNG BỘ DỮ LIỆU TỪ LOCAL LÊN TURSO CLOUD");
  console.log("==================================================");
  console.log(`📁 Local file : ${localDbPath}`);
  console.log(`☁️ Turso URL  : ${tursoUrl}\n`);

  // 1. Connect local
  const localClient = createClient({
    url: `file:${localDbPath}`
  });

  console.log("⏳ Đang đọc dữ liệu từ local database...");
  const localRes = await localClient.execute("SELECT * FROM orders ORDER BY rowid ASC");
  const total = localRes.rows.length;
  console.log(`✅ Đã nạp thành công ${total.toLocaleString()} đơn hàng từ local database!`);

  if (total === 0) {
    console.log("ℹ️ Local database đang trống, không có đơn để chuyển.");
    process.exit(0);
  }

  // 2. Connect Turso
  console.log("\n⏳ Đang kết nối tới Turso Cloud...");
  const tursoClient = createClient({
    url: tursoUrl,
    authToken: tursoToken || undefined
  });

  // Create schema on Turso if not exists
  console.log("⏳ Khởi tạo cấu trúc bảng trên Turso...");
  await tursoClient.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      tracking_code TEXT UNIQUE NOT NULL,
      order_no TEXT,
      carrier TEXT NOT NULL,
      carrier_channel TEXT,
      status_category TEXT NOT NULL,
      raw_status_text TEXT,
      status_detail TEXT,
      scanned_at TEXT,
      updated_at TEXT,
      order_created_at TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      warehouse_id TEXT,
      warehouse_name TEXT,
      source TEXT,
      payload_json TEXT NOT NULL
    );
  `);
  await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);");
  await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier);");
  await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status_category);");
  await tursoClient.execute("CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);");
  console.log("✅ Cấu trúc bảng và index trên Turso đã sẵn sàng!");

  // 3. Batch insert in chunks of 200
  console.log(`\n⏳ Đang đẩy ${total.toLocaleString()} đơn hàng lên Turso Cloud theo từng đợt...`);
  const BATCH_SIZE = 200;
  let pushed = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = localRes.rows.slice(i, i + BATCH_SIZE);
    const statements: InStatement[] = chunk.map((r: any) => ({
      sql: `
        INSERT INTO orders (
          id, tracking_code, order_no, carrier, carrier_channel,
          status_category, raw_status_text, status_detail, scanned_at,
          updated_at, order_created_at, customer_name, customer_phone,
          warehouse_id, warehouse_name, source, payload_json
        ) VALUES (
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
        ON CONFLICT(tracking_code) DO UPDATE SET
          carrier = excluded.carrier,
          status_category = excluded.status_category,
          raw_status_text = excluded.raw_status_text,
          status_detail = excluded.status_detail,
          scanned_at = COALESCE(excluded.scanned_at, orders.scanned_at),
          updated_at = excluded.updated_at,
          order_no = COALESCE(excluded.order_no, orders.order_no),
          carrier_channel = COALESCE(excluded.carrier_channel, orders.carrier_channel),
          warehouse_id = COALESCE(excluded.warehouse_id, orders.warehouse_id),
          warehouse_name = COALESCE(excluded.warehouse_name, orders.warehouse_name),
          source = COALESCE(excluded.source, orders.source),
          payload_json = excluded.payload_json;
      `,
      args: [
        r.id,
        r.tracking_code,
        r.order_no ?? null,
        r.carrier ?? "unknown",
        r.carrier_channel ?? null,
        r.status_category ?? "not_scanned",
        r.raw_status_text ?? "",
        r.status_detail ?? null,
        r.scanned_at ?? null,
        r.updated_at ?? new Date().toISOString(),
        r.order_created_at ?? null,
        r.customer_name ?? null,
        r.customer_phone ?? null,
        r.warehouse_id ?? null,
        r.warehouse_name ?? null,
        r.source ?? null,
        r.payload_json
      ]
    }));

    await tursoClient.batch(statements, "write");
    pushed += chunk.length;
    const pct = Math.round((pushed / total) * 100);
    process.stdout.write(`\r📦 Tiến độ: ${pushed.toLocaleString()} / ${total.toLocaleString()} đơn (${pct}%)`);
  }

  console.log("\n\n🎉 CHÚC MỪNG: ĐÃ ĐỒNG BỘ THÀNH CÔNG TOÀN BỘ DỮ LIỆU LÊN TURSO CLOUD!");
  console.log("👉 Giờ đây bạn có thể deploy lên Render, dữ liệu sẽ luôn sẵn sàng 24/24.");
}

migrate().catch((err) => {
  console.error("\n❌ LỖI TRONG QUÁ TRÌNH ĐỒNG BỘ:", err);
  process.exit(1);
});
