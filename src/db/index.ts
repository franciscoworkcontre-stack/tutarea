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

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

export const db = drizzle(
  async (sql, params, method) => {
    const { data, error } = await supabaseAdmin.rpc("drizzle_query", {
      query_sql: sql,
      query_params: params,
      query_method: method,
    });

    if (error) throw new Error(`DB query failed: ${error.message}`);

    // drizzle_query returns TEXT; parse it regardless of how PostgREST serialized it
    const parsed: unknown = typeof data === "string" ? JSON.parse(data) : data;
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
