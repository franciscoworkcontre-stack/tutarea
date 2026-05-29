import { drizzle } from "drizzle-orm/pg-proxy";
import * as schema from "./schema";
import * as https from "node:https";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]?.trim();
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production");
  }
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

// Use node:https directly instead of fetch/undici to bypass the Node 24 +
// Vercel bug where undici fetch hangs indefinitely during TLS handshake with
// Supabase (AbortSignal and AbortController both fail to abort the stalled
// request in this environment).
function httpsPost(url: string, headers: Record<string, string>, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
        timeout: 9000,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("DB RPC timeout after 9s"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const rpcUrl = `${supabaseUrl}/rest/v1/rpc/drizzle_query`;
const rpcHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

export const db = drizzle(
  async (sql, params, method) => {
    console.log("[db-sql]", sql.slice(0, 150), "| params:", JSON.stringify(params).slice(0, 80));

    let data: string;
    try {
      data = await httpsPost(
        rpcUrl,
        rpcHeaders,
        JSON.stringify({ query_sql: sql, query_params: params, query_method: method })
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[db-rpc-error]", msg);
      throw new Error(`DB query failed: ${msg}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch (e) {
      console.error("[db-parse-fail-a]", data.slice(0, 120));
      console.error("[db-parse-fail-b]", data.slice(120, 240));
      console.error("[db-parse-fail-c]", data.slice(-80));
      throw e;
    }

    const rows =
      method === "execute"
        ? []
        : (Array.isArray(parsed) ? parsed : []).map((row: Record<string, unknown>) =>
            Object.values(row)
          );

    return { rows };
  },
  { schema }
);

export type DB = typeof db;
export * from "./schema";
