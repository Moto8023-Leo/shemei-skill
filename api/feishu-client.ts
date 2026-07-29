/**
 * Shared Feishu Bitable API client for Vercel Serverless Functions.
 * Replaces scripts/feishu_driver.py with TypeScript.
 */

// ---- Token Management ----
let _tokenCache: { token: string; expiresAt: number } = { token: "", expiresAt: 0 };

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (_tokenCache.token && now < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("FEISHU_APP_ID and FEISHU_APP_SECRET must be set in Vercel environment variables");
  }

  const resp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });

  const data = await resp.json() as any;
  if (data.code !== 0) {
    throw new Error(`Feishu token error: ${data.msg} (code=${data.code})`);
  }

  _tokenCache = {
    token: data.tenant_access_token,
    expiresAt: now + 5400 * 1000, // 1.5h cache, actual expiry is 2h
  };

  return _tokenCache.token;
}

function getHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json; charset=utf-8",
  };
}

// ---- Brand-to-Table Mapping (from scripts/brand_config.py) ----
interface BrandTables {
  scheduleTableId: string;
  productTableId: string;
  configTableId: string;
}

const BRAND_TABLES: Record<string, BrandTables> = {
  ienyrid: {
    scheduleTableId: "tblTZTeXWry93slq",
    productTableId: "tblHbkPBjJ3uQOf9",
    configTableId: "tblS9CatxxC9og5e",
  },
  kukirin: {
    scheduleTableId: "tblw90DsOkPcqp5T",
    productTableId: "tblLuzRzU99fBwqw",
    configTableId: "tblWu2mnf0637FX9",
  },
};

const DEFAULT_BRAND = "ienyrid";

function resolveBrand(brand?: string): string {
  const b = (brand || "").trim().toLowerCase();
  return BRAND_TABLES[b] ? b : DEFAULT_BRAND;
}

function resolveTables(brand: string): BrandTables {
  return BRAND_TABLES[brand] || BRAND_TABLES[DEFAULT_BRAND];
}

// ---- Generic Record Operations ----

const BASE_URL = "https://open.feishu.cn/open-apis/bitable/v1";
const APP_TOKEN = process.env.FEISHU_APP_TOKEN || "QFrowVpL3iIMAYkCE2PcaZCEnJe";

interface FeishuRecord {
  record_id: string;
  fields: Record<string, any>;
}

async function getRecords(tableId: string): Promise<FeishuRecord[]> {
  const token = await getAccessToken();
  const allRecords: FeishuRecord[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ page_size: "100" });
    if (pageToken) params.set("page_token", pageToken);

    const resp = await fetch(
      `${BASE_URL}/apps/${APP_TOKEN}/tables/${tableId}/records?${params}`,
      { headers: getHeaders(token) }
    );
    const data = await resp.json() as any;

    if (data.code !== 0) {
      throw new Error(`Feishu read error: ${data.msg} (code=${data.code})`);
    }

    const items = data.data?.items || [];
    allRecords.push(...items);

    pageToken = data.data?.has_more ? data.data?.page_token : undefined;
  } while (pageToken);

  return allRecords;
}

async function getRecord(tableId: string, recordId: string): Promise<FeishuRecord | null> {
  const token = await getAccessToken();
  const resp = await fetch(
    `${BASE_URL}/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`,
    { headers: getHeaders(token) }
  );
  const data = await resp.json() as any;
  if (data.code !== 0) return null;
  return data.data?.record || null;
}

async function updateRecord(tableId: string, recordId: string, fields: Record<string, any>): Promise<boolean> {
  const token = await getAccessToken();
  const body = JSON.stringify({ fields });
  const resp = await fetch(
    `${BASE_URL}/apps/${APP_TOKEN}/tables/${tableId}/records/${recordId}`,
    {
      method: "PUT",
      headers: getHeaders(token),
      body,
    }
  );
  const data = await resp.json() as any;
  return data.code === 0;
}

async function createRecord(tableId: string, fields: Record<string, any>): Promise<string | null> {
  const token = await getAccessToken();
  const body = JSON.stringify({ fields });
  const resp = await fetch(
    `${BASE_URL}/apps/${APP_TOKEN}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: getHeaders(token),
      body,
    }
  );
  const data = await resp.json() as any;
  if (data.code !== 0) return null;
  return data.data?.record?.record_id || null;
}

// ---- Helpers ----

function getText(fields: Record<string, any>, key: string): string {
  const val = fields[key];
  if (val == null) return "";
  if (Array.isArray(val)) return String(val[0] || "");
  if (typeof val === "object") return String(val.text || val.value || "");
  return String(val);
}

function getImageUrl(fields: Record<string, any>, key: string): string {
  const val = fields[key];
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === "object") {
      return first.url || first.tmp_url || "";
    }
    return String(first);
  }
  return "";
}

export {
  // Token
  getAccessToken,
  getHeaders,

  // Brand
  resolveBrand,
  resolveTables,
  DEFAULT_BRAND,
  BRAND_TABLES,

  // Records
  getRecords,
  getRecord,
  updateRecord,
  createRecord,

  // Helpers
  getText,
  getImageUrl,

  // Types
  APP_TOKEN,
  BASE_URL,
};

export type { FeishuRecord, BrandTables };
