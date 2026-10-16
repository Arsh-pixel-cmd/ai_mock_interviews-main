// Universal Cloudflare D1 Database Client
// Works both in Cloudflare Workers/Pages runtime (via binding)
// and in local development / Node.js (via Cloudflare D1 REST API)

interface D1Result<T = any> {
  results?: T[];
  success: boolean;
  meta?: any;
}

// Helper to get native Cloudflare binding if available
async function getD1Binding(): Promise<any | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const dbBinding = (ctx?.env as any)?.DB;
    if (dbBinding) {
      return dbBinding;
    }
  } catch {
    // Not running inside Cloudflare runtime
  }

  if (typeof (globalThis as any).DB !== "undefined") {
    return (globalThis as any).DB;
  }

  return null;
}

// Query helper via Cloudflare D1 REST API (used in local development)
async function executeViaRestApi(sql: string, params: any[] = []): Promise<any[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error(
      "Cloudflare D1 is not configured. Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_D1_DATABASE_ID, and CLOUDFLARE_API_TOKEN in .env.local"
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql,
        params,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!data.success) {
    const errorMsg = data.errors?.[0]?.message || "Cloudflare D1 query failed";
    throw new Error(errorMsg);
  }

  const queryResult = data.result?.[0];
  return queryResult?.results || [];
}

/**
 * Execute a SELECT query and return an array of rows
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const db = await getD1Binding();

  if (db) {
    const stmt = db.prepare(sql).bind(...params);
    const { results } = await stmt.all();
    return (results || []) as T[];
  }

  return (await executeViaRestApi(sql, params)) as T[];
}

/**
 * Execute a SELECT query and return the first row (or null)
 */
export async function queryFirst<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute an INSERT / UPDATE / DELETE query
 */
export async function execute(sql: string, params: any[] = []): Promise<{ success: boolean }> {
  const db = await getD1Binding();

  if (db) {
    const stmt = db.prepare(sql).bind(...params);
    await stmt.run();
    return { success: true };
  }

  await executeViaRestApi(sql, params);
  return { success: true };
}
