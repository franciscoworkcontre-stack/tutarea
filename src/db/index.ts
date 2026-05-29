import { drizzle } from "drizzle-orm/pg-proxy";
import { createClient } from "@supabase/supabase-js";
import * as schema from "./schema";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in production");
  }
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
}

// Wrap fetch with a 9-second timeout so DB calls fail fast instead of hanging
// indefinitely (Node 24 keep-alive behaviour on Vercel can stall fetch forever).
const fetchWithTimeout: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  // Force connection close to avoid Node 24 keep-alive stalls on Vercel.
  headers.set("connection", "close");
  return fetch(input, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(9000),
  });
};

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  global: { fetch: fetchWithTimeout },
});

export const db = drizzle(
  async (sql, params, method) => {
    console.log("[db-sql]", sql.slice(0, 150), "| params:", JSON.stringify(params).slice(0, 80));

    const { data, error } = await supabaseAdmin.rpc("drizzle_query", {
      query_sql: sql,
      query_params: params,
      query_method: method,
    });

    if (error) {
      console.error("[db-rpc-error]", error.message);
      throw new Error(`DB query failed: ${error.message}`);
    }

    let parsed: unknown;
    if (typeof data === "string") {
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.error("[db-parse-fail-a]", data.slice(0, 120));
        console.error("[db-parse-fail-b]", data.slice(120, 240));
        console.error("[db-parse-fail-c]", data.slice(-80));
        throw e;
      }
    } else {
      parsed = data;
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
