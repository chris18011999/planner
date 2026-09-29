import { boolean, customType, date, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

// Better Auth owns this table from ticket 09 on. The columns follow the shape that its Drizzle adapter expects.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    markdown: text("markdown").notNull(),
    version: text("version").notNull(),
    date: date("date", { mode: "string" }),
    title: text("title").notNull(),
    openTodoCount: integer("open_todo_count").notNull(),
    todoCount: integer("todo_count").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.ownerId, table.path)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    mediaType: text("media_type").notNull(),
    content: bytea("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.ownerId, table.path)],
);
