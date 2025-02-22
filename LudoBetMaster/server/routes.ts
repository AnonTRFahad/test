import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { setupWebSocket } from "./websocket";
import { setupWebSocket as setupGameWebSocket } from "./game";
import { storage } from "./storage";
import { insertMatchSchema, transactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  const httpServer = createServer(app);
  setupWebSocket(httpServer);
  setupGameWebSocket(httpServer);

  // Admin routes
  const adminPinSchema = z.object({ pin: z.string() });

  app.post("/api/admin/verify", (req, res) => {
    const { pin } = adminPinSchema.parse(req.body);
    if (pin === process.env.ADMIN_PIN) {
      res.sendStatus(200);
    } else {
      res.sendStatus(401);
    }
  });

  app.get("/api/admin/transactions", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const transactions = await storage.getPendingTransactions();
    res.json(transactions);
  });

  app.get("/api/admin/transactions/all", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const transactions = await storage.getAllTransactions();
    res.json(transactions);
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const users = await storage.getAllUsers();
    res.json(users.map(user => ({ ...user, password: undefined })));
  });

  // Matches
  app.get("/api/matches", async (req, res) => {
    const matches = await storage.getActiveMatches();
    res.json(matches);
  });

  app.post("/api/matches", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const data = insertMatchSchema.parse(req.body);
      const match = await storage.createMatch({
        ...data,
        creatorId: req.user.id,
        status: "waiting",
        winnerId: null
      });
      res.json(match);
    } catch (error) {
      console.error('Error creating match:', error);
      res.status(400).json({ message: "Invalid match data" });
    }
  });

  // Transactions
  app.post("/api/transactions", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const data = transactionSchema.parse(req.body);
      const transaction = await storage.createTransaction({
        ...data,
        userId: req.user.id,
        status: "pending",
        orderId: data.orderId || null
      });
      res.json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(400).json({ message: "Invalid transaction data" });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const transactions = await storage.getUserTransactions(req.user.id);
    res.json(transactions);
  });

  app.post("/api/admin/transactions/:id/approve", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    await storage.approveTransaction(id);
    res.sendStatus(200);
  });

  app.post("/api/admin/transactions/:id/reject", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    await storage.rejectTransaction(id);
    res.sendStatus(200);
  });

  app.post("/api/admin/transactions/:id/delete", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const id = parseInt(req.params.id);
    await storage.deleteTransaction(id);
    res.sendStatus(200);
  });

  return httpServer;
}