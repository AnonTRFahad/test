import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { WebSocketMessage } from '@shared/schema';
import { parse } from 'cookie';
import { getSessionMiddleware } from './auth';
import type { IncomingMessage } from 'http';

// Store WebSocket connections
const connections = new Map<number, WebSocket>();

export function addConnection(userId: number, ws: WebSocket) {
  connections.set(userId, ws);
}

export function removeConnection(userId: number) {
  connections.delete(userId);
}

export function broadcastToUser(userId: number, message: WebSocketMessage) {
  const connection = connections.get(userId);
  if (connection?.readyState === WebSocket.OPEN) {
    connection.send(JSON.stringify(message));
  }
}

export function broadcastToAdmin(message: WebSocketMessage) {
  // Broadcast to all connected admins
  for (const [, ws] of Array.from(connections.entries())) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

async function parseSession(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Parsing session from WebSocket request');
      const sessionMiddleware = getSessionMiddleware();
      sessionMiddleware(req as any, {} as any, (err: any) => {
        if (err) {
          console.error('Session parsing error:', err);
          reject(err);
          return;
        }
        console.log('Session parsed successfully:', {
          hasSession: !!(req as any).session,
          hasUser: !!(req as any).session?.passport?.user
        });
        resolve((req as any).session);
      });
    } catch (error) {
      console.error('Error in parseSession:', error);
      reject(error);
    }
  });
}

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: async (info, cb) => {
      try {
        const req = info.req;
        console.log('WebSocket connection attempt, verifying client');

        // Parse session from cookies
        await parseSession(req);
        const session = (req as any).session;

        if (!session?.passport?.user) {
          console.log('WebSocket connection rejected: no authenticated session');
          cb(false, 401, 'Unauthorized');
          return;
        }

        console.log(`WebSocket connection authorized for user: ${session.passport.user}`);
        cb(true);
      } catch (error) {
        console.error('WebSocket verification error:', error);
        cb(false, 500, 'Internal Server Error');
      }
    }
  });

  wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
    console.log('New WebSocket connection established');
    let userId: number | undefined;

    try {
      // Re-parse session to ensure we have the latest data
      await parseSession(req);
      const session = (req as any).session;
      userId = session?.passport?.user;

      if (userId) {
        connections.set(userId, ws);
        console.log(`User ${userId} connected to WebSocket`);
      } else {
        console.error('No user ID in session after connection');
        ws.close(1008, 'No authenticated user');
        return;
      }
    } catch (error) {
      console.error('Error establishing WebSocket connection:', error);
      ws.close(1011, 'Internal Server Error');
      return;
    }

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('WebSocket message received:', data);

        if (data.type === 'join' && userId) {
          console.log(`User ${userId} joined WebSocket chat`);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    ws.on('close', () => {
      if (userId) {
        connections.delete(userId);
        console.log(`User ${userId} disconnected from WebSocket`);
      }
    });
  });

  return wss;
}