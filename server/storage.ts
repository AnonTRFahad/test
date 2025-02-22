import { IStorage } from "./storage";
import session from "express-session";
import createMemoryStore from "memorystore";
import { users, transactions, matches, type User, type Transaction, type InsertUser, type Match } from "@shared/schema";
import { randomBytes } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { WebSocket } from "ws";
import type { WebSocketMessage } from "@shared/schema";

const MemoryStore = createMemoryStore(session);

// Store WebSocket connections
const connections = new Map<number, WebSocket>();

export function addConnection(userId: number, ws: WebSocket) {
  connections.set(userId, ws);
}

export function removeConnection(userId: number) {
  connections.delete(userId);
}

function broadcastToUser(userId: number, message: WebSocketMessage) {
  const connection = connections.get(userId);
  if (connection?.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
  }
}

function broadcastToAdmin(message: WebSocketMessage) {
  // Broadcast to all connected admins
  for (const [userId, ws] of Array.from(connections.entries())) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByReferralCode(code: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, code));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser & { referralCode?: string }): Promise<User> {
    let referredBy = null;
    if (insertUser.referralCode) {
      const referrer = await this.getUserByReferralCode(insertUser.referralCode);
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        referralCode: Math.random().toString(36).substring(2, 8),
        referredBy,
      })
      .returning();

    return user;
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();

    // Broadcast user update
    broadcastToUser(userId, {
      type: "user_update",
      user: { ...user, password: undefined },
    });

    return user;
  }

  async createMatch(match: Omit<Match, 'id' | 'created'>): Promise<Match> {
    const [newMatch] = await db
      .insert(matches)
      .values(match)
      .returning();

    return newMatch;
  }
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db
      .select()
      .from(matches)
      .where(eq(matches.id, id));
    return match;
  }
  async getActiveMatches(): Promise<Match[]> {
    return await db
      .select()
      .from(matches)
      .where(eq(matches.status, "waiting"));
  }
  async updateMatchWinner(matchId: number, winnerId: number): Promise<void> {
    await db
      .update(matches)
      .set({
        status: "finished",
        winnerId
      })
      .where(eq(matches.id, matchId));
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'created'>): Promise<Transaction> {
    // If it's a withdrawal, verify and deduct balance first
    if (transaction.type === "withdrawal") {
      const user = await this.getUser(transaction.userId);
      if (user) {
        const balance = parseFloat(user.balance);
        const amount = parseFloat(transaction.amount.toString());
        if (balance >= amount) {
          await this.updateUser(user.id, {
            balance: (balance - amount).toString(),
          });
        } else {
          throw new Error("Insufficient balance");
        }
      }
    }

    const [newTx] = await db
      .insert(transactions)
      .values(transaction)
      .returning();

    // Broadcast transaction creation
    broadcastToUser(transaction.userId, {
      type: "transaction_update",
      transaction: newTx,
    });
    broadcastToAdmin({
      type: "transaction_update",
      transaction: newTx,
    });

    return newTx;
  }

  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction;
  }

  async getUserTransactions(userId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId));
  }

  async getPendingTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.status, "pending"));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async approveTransaction(id: number): Promise<void> {
    const tx = await this.getTransaction(id);
    if (!tx) return;

    const [updatedTx] = await db
      .update(transactions)
      .set({ status: "approved" })
      .where(eq(transactions.id, id))
      .returning();

    // For deposits, add balance to user
    if (tx.type === "deposit") {
      const user = await this.getUser(tx.userId);
      if (user) {
        const balance = parseFloat(user.balance);
        const amount = parseFloat(tx.amount.toString());
        await this.updateUser(user.id, {
          balance: (balance + amount).toString(),
        });
      }
    }

    // Broadcast updates
    broadcastToUser(tx.userId, {
      type: "transaction_update",
      transaction: updatedTx,
    });
    broadcastToAdmin({
      type: "transaction_update",
      transaction: updatedTx,
    });
  }

  async rejectTransaction(id: number): Promise<void> {
    const tx = await this.getTransaction(id);
    if (!tx) return;

    const [updatedTx] = await db
      .update(transactions)
      .set({ status: "rejected" })
      .where(eq(transactions.id, id))
      .returning();

    // For withdrawals, refund the balance
    if (tx.type === "withdrawal") {
      const user = await this.getUser(tx.userId);
      if (user) {
        const balance = parseFloat(user.balance);
        const amount = parseFloat(tx.amount.toString());
        await this.updateUser(user.id, {
          balance: (balance + amount).toString(),
        });
      }
    }

    // Broadcast updates
    broadcastToUser(tx.userId, {
      type: "transaction_update",
      transaction: updatedTx,
    });
    broadcastToAdmin({
      type: "transaction_update",
      transaction: updatedTx,
    });
  }

  async deleteTransaction(id: number): Promise<void> {
    const tx = await this.getTransaction(id);
    if (!tx) return;

    await db.delete(transactions).where(eq(transactions.id, id));

    // Broadcast deletion
    broadcastToUser(tx.userId, {
      type: "transaction_deleted",
      transactionId: id,
    });
    broadcastToAdmin({
      type: "transaction_deleted",
      transactionId: id,
    });
  }
}

export const storage = new DatabaseStorage();