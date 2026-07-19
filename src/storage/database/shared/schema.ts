import { pgTable, serial, timestamp, varchar, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const profiles = pgTable(
  "profiles",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    user_id: varchar("user_id", { length: 36 }).notNull().unique(),
    role: varchar("role", { length: 20 }).notNull().default("enterprise"),
    full_name: varchar("full_name", { length: 128 }),
    company_name: varchar("company_name", { length: 255 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("profiles_user_id_idx").on(table.user_id),
    index("profiles_role_idx").on(table.role),
  ]
);
