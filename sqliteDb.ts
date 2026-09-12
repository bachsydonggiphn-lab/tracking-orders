import { createClient, Client, InStatement } from "@libsql/client";
import path from "path";
import fs from "fs";
import { OrderItem } from "./src/types/tracking";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "tracking.sqlite");
const STATE_JSON_PATH = path.join(DATA_DIR, "orders_state.json");

let clientInstance: Client | null = null;
let isInitialized = false;

export function getSqliteDb(): Client {
  if (!clientInstance) {
    const tursoUrl = (process.env.TURSO_DATABASE_URL || "").trim();
    const tursoToken = (process.env.TURSO_AUTH_TOKEN || "").trim();

    if (tursoUrl) {
      console.log(`[Database] Đang kết nối tới Turso Cloud: ${tursoUrl}`);
      clientInstance = createClient({
        url: tursoUrl,
        authToken: tursoToken || undefined
      });
    } else {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      console.log(`[Database] Đang chạy với SQLite Local file: ${DB_PATH}`);
      clientInstance = createClient({
        url: `file:${DB_PATH}`
      });
    }
  }

  return clientInstance;
}

export async function initSqliteDb(): Promise<void> {
  if (isInitialized) return;
  const db = getSqliteDb();

  try {
    // Create schema
    await db.execute(`
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

    await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_tracking_code ON orders(tracking_code);");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_carrier ON orders(carrier);");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status_category);");
    await db.execute("CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);");

    isInitialized = true;

    // Migrate from legacy orders_state.json if database is currently empty
    await tryAutoMigrateFromJson(db);
  } catch (err) {
    console.error("[Database Init Error]", err);
  }
}

async function tryAutoMigrateFromJson(db: Client) {
  try {
    const res = await db.execute("SELECT count(*) as count FROM orders");
    const count = Number(res.rows[0]?.count ?? 0);
    if (count === 0 && fs.existsSync(STATE_JSON_PATH)) {
      const raw = fs.readFileSync(STATE_JSON_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      const ordersList: OrderItem[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.orders) ? parsed.orders : []);
      if (ordersList.length > 0) {
        console.log(`[SQLite Migration] Đang chuyển ${ordersList.length} đơn từ orders_state.json vào Database...`);
        await upsertSqliteOrders(ordersList);
        console.log(`[SQLite Migration] Chuyển đổi thành công ${ordersList.length} đơn vào database!`);
      }
    }
  } catch (err) {
    console.error("[SQLite Migration Error]", err);
  }
}

export async function getAllSqliteOrders(): Promise<OrderItem[]> {
  await initSqliteDb();
  const db = getSqliteDb();
  const res = await db.execute("SELECT payload_json FROM orders ORDER BY rowid ASC");
  const results: OrderItem[] = [];
  for (const row of res.rows) {
    try {
      const json = (row.payload_json ?? (row as any)[0]) as string;
      if (json) {
        results.push(JSON.parse(json));
      }
    } catch {
      // skip individual corrupted row
    }
  }
  return results;
}

export async function getSqliteStats() {
  await initSqliteDb();
  const db = getSqliteDb();

  try {
    const [totalRes, statusRes] = await Promise.all([
      db.execute("SELECT count(*) as total FROM orders"),
      db.execute("SELECT status_category, count(*) as count FROM orders GROUP BY status_category")
    ]);

    const total = Number(totalRes.rows[0]?.total ?? 0);
    const statsMap: Record<string, number> = {};
    for (const r of statusRes.rows) {
      const cat = String(r.status_category ?? "");
      const count = Number(r.count ?? 0);
      if (cat) statsMap[cat] = count;
    }

    return {
      total,
      scanned: statsMap["scanned"] || 0,
      not_scanned: statsMap["not_scanned"] || 0,
      cancelled: statsMap["cancelled"] || 0,
      in_transit: statsMap["in_transit"] || 0,
      delivered: statsMap["delivered"] || 0,
      returned: statsMap["returned"] || 0,
      error: statsMap["error"] || 0
    };
  } catch (err) {
    console.error("[getSqliteStats Error]", err);
    return {
      total: 0,
      scanned: 0,
      not_scanned: 0,
      cancelled: 0,
      in_transit: 0,
      delivered: 0,
      returned: 0,
      error: 0
    };
  }
}

export async function upsertSqliteOrders(orders: OrderItem[]): Promise<number> {
  if (!orders || orders.length === 0) return 0;
  await initSqliteDb();
  const db = getSqliteDb();

  // 1. Gather all tracking codes to fetch existing records in batches
  const codeList = orders.map(o => (o.trackingCode || "").trim()).filter(Boolean);
  const existingMap = new Map<string, OrderItem>();

  // Fetch in chunks of 400 to avoid query param limit
  const CHUNK_SIZE = 400;
  for (let i = 0; i < codeList.length; i += CHUNK_SIZE) {
    const chunk = codeList.slice(i, i + CHUNK_SIZE);
    const placeholders = chunk.map(() => "?").join(",");
    try {
      const res = await db.execute({
        sql: `SELECT tracking_code, payload_json FROM orders WHERE tracking_code IN (${placeholders})`,
        args: chunk
      });
      for (const row of res.rows) {
        const code = String(row.tracking_code || "");
        const jsonStr = String(row.payload_json || "");
        if (code && jsonStr) {
          try {
            existingMap.set(code, JSON.parse(jsonStr));
          } catch {}
        }
      }
    } catch {}
  }

  // 2. Prepare UPSERT statements with intelligent merge
  const statements: InStatement[] = [];

  for (const item of orders) {
    const cleanCode = (item.trackingCode || "").trim();
    if (!cleanCode) continue;

    let merged = item;
    const old = existingMap.get(cleanCode);

    if (old) {
      // If old was ALREADY scanned/in_transit/delivered/returned, an unscanned placeholder MUST NEVER overwrite it!
      const oldIsScanned = Boolean(
        (old.statusCategory && old.statusCategory !== 'not_scanned') ||
        old.scannedAt ||
        (Array.isArray(old.timeline) && old.timeline.length > 0 && old.timeline.some(t => !t.statusText?.includes('chuẩn bị') && !t.statusText?.includes('chờ lấy')))
      );

      const itemHasNewCarrierScan = Boolean(
        (item.statusCategory && item.statusCategory !== 'not_scanned') ||
        item.scannedAt ||
        (Array.isArray(item.timeline) && item.timeline.length > 0 && item.timeline.some(t => !t.statusText?.includes('chuẩn bị') && !t.statusText?.includes('chờ lấy')))
      );

      if (oldIsScanned && !itemHasNewCarrierScan && item.statusCategory !== 'cancelled') {
        // Old was ALREADY scanned by courier/hub! Unscanned item MUST NOT overwrite scanned status!
        merged = {
          ...item,
          ...old,
          statusCategory: old.statusCategory,
          rawStatusText: old.rawStatusText,
          statusDetail: old.statusDetail,
          scannedAt: old.scannedAt,
          updatedAt: old.updatedAt || item.updatedAt,
          timeline: (Array.isArray(old.timeline) && old.timeline.length > 0) ? old.timeline : (item.timeline || []),
          orderNo: item.orderNo || old.orderNo,
          warehouseId: item.warehouseId || old.warehouseId,
          warehouseName: item.warehouseName || old.warehouseName,
          carrierChannel: item.carrierChannel || old.carrierChannel,
          wmsStatus: item.wmsStatus || old.wmsStatus,
          extraInfo: {
            ...(old.extraInfo || {}),
            ...(item.extraInfo || {})
          },
          isChecking: false
        };
      } else {
        const hasNewTimeline = Array.isArray(item.timeline) && item.timeline.length > 0;
        const mergedTimeline = hasNewTimeline ? item.timeline : (old.timeline || []);

        merged = {
          ...old,
          ...item,
          scannedAt: item.scannedAt || old.scannedAt,
          timeline: mergedTimeline,
          extraInfo: {
            ...(old.extraInfo || {}),
            ...(item.extraInfo || {})
          },
          orderNo: item.orderNo || old.orderNo,
          warehouseId: item.warehouseId || old.warehouseId,
          warehouseName: item.warehouseName || old.warehouseName,
          carrierChannel: item.carrierChannel || old.carrierChannel,
          wmsStatus: item.wmsStatus || old.wmsStatus,
          isChecking: false
        };
      }
    }

    const id = merged.id || `order_${cleanCode}`;
    const payloadJson = JSON.stringify(merged);

    statements.push({
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
        id,
        cleanCode,
        merged.orderNo || null,
        merged.carrier || "unknown",
        merged.carrierChannel || null,
        merged.statusCategory || "not_scanned",
        merged.rawStatusText || "",
        merged.statusDetail || null,
        merged.scannedAt || null,
        merged.updatedAt || new Date().toISOString(),
        merged.extraInfo?.orderDate || null,
        merged.extraInfo?.shopName || null,
        merged.extraInfo?.customerPhone || null,
        merged.warehouseId || null,
        merged.warehouseName || null,
        merged.source || null,
        payloadJson
      ]
    });
  }

  // 3. Execute batch in chunks of 200 statements
  const BATCH_SIZE = 200;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    await db.batch(chunk, "write");
  }

  return orders.length;
}

export async function clearSqliteOrders(): Promise<void> {
  await initSqliteDb();
  const db = getSqliteDb();
  await db.execute("DELETE FROM orders;");
}
