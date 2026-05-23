import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function getClient() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString || connectionString === "your_postgres_connection_string") {
    // Return a dummy during build
    return null;
  }
  return postgres(connectionString, {
    prepare: false,
    max: 1,
    ssl: "require",
  });
}

const client = getClient();

if (!client && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is not configured in production");
}

export const db = drizzle(client ?? postgres("postgresql://localhost/tutarea_dev", { prepare: false, max: 1 }), { schema });
export type DB = typeof db;
export * from "./schema";
