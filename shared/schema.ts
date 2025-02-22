import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define tables first
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).notNull().default("0"),
  referralCode: text("referral_code").notNull(),
  referredBy: integer("referred_by"),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull(),
  betAmount: decimal("bet_amount", { precision: 10, scale: 2 }).notNull(),
  maxPlayers: integer("max_players").notNull(),
  status: text("status", { enum: ["waiting", "playing", "finished"] }).notNull(),
  winnerId: integer("winner_id"),
  created: timestamp("created").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["deposit", "withdrawal", "bet", "win", "referral"] }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull(),
  orderId: text("order_id"),
  created: timestamp("created").notNull().defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ one }) => ({
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  creator: one(users, {
    fields: [matches.creatorId],
    references: [users.id],
  }),
  winner: one(users, {
    fields: [matches.winnerId],
    references: [users.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
}));

// Schema and types
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMatchSchema = createInsertSchema(matches).pick({
  betAmount: true,
  maxPlayers: true,
}).transform((data) => ({
  ...data,
  betAmount: typeof data.betAmount === 'number' ? data.betAmount.toString() : data.betAmount,
  maxPlayers: Number(data.maxPlayers)
}));

export const transactionSchema = createInsertSchema(transactions).pick({
  type: true,
  amount: true,
  orderId: true,
}).extend({
  orderId: z.string().nullable().optional(),
  amount: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'number' ? val.toString() : val
  )
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;

// Game state types
export type GamePlayer = {
  id: number;
  username: string;
  position: number;
  pieces: number[];
};

export type GameState = {
  matchId: number;
  players: GamePlayer[];
  currentTurn: number;
  diceValue?: number;
  winner?: number;
};

// WebSocket message types
export type WebSocketMessage =
  | { type: "balance_update"; userId: number; balance: string }
  | { type: "transaction_update"; transaction: Transaction }
  | { type: "transaction_deleted"; transactionId: number }
  | { type: "user_update"; user: Omit<User, "password"> }
  | { type: "match_update"; match: Match }
  | { type: "game_state_update"; gameState: GameState };