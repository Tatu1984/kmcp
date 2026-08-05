import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 keeps the datasource URL here, not in schema.prisma.
 */
export default defineConfig({
  schema: path.join("src", "backend", "database", "prisma", "schema.prisma"),
  migrations: {
    path: path.join("src", "backend", "database", "prisma", "migrations"),
    seed: "tsx src/backend/database/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
