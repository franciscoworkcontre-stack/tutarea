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

// Wrap fetch with a 9-second timeout. AbortSignal.timeout() doesn't always
// propagate through undici (Node 24 on Vercel), so we use a manual
// AbortController + setTimeout which reliably aborts the fetch.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers);
  // Force connection close to avoid Node 24 keep-alive stalls on Vercel.
  headers.set("connection", "close");
  if (init?.signal) {
    // Caller supplied a signal; respect it and add connection:close only.
    return fetch(input, { ...init, headers });
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error("DB fetch timeout after 9s")), 9000);
  return fetch(input, { ...init, headers, signal: ac.signal }).finally(() =>
    clearTimeout(timer)
  );
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
