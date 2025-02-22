import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { GameState, Match } from '@shared/schema';
import { storage } from './storage';

const games = new Map<number, GameState>();
const connections = new Map<number, WebSocket>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/game' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('New game WebSocket connection established');
    let userId: number | undefined;

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('Game message received:', data);

        switch (data.type) {
          case 'join':
            if (!data.userId) {
              console.error('Cannot join: missing user ID');
              return;
            }
            userId = data.userId;
            connections.set(userId, ws);
            console.log(`User ${userId} joined game WebSocket`);
            break;

          case 'create_match':
            if (!userId) {
              console.error('Cannot create match: no user ID');
              return;
            }
            try {
              console.log('Creating match...', data);
              const betAmount = typeof data.betAmount === 'number' 
                ? data.betAmount.toString() 
                : data.betAmount;

              const match = await storage.createMatch({
                creatorId: userId,
                betAmount,
                maxPlayers: Number(data.maxPlayers),
                status: 'waiting',
                winnerId: null
              });

              const gameState: GameState = {
                matchId: match.id,
                players: [{
                  id: userId,
                  username: data.username,
                  position: 0,
                  pieces: [0, 0, 0, 0]
                }],
                currentTurn: userId
              };

              games.set(match.id, gameState);
              broadcastGameState(gameState);
              console.log('Match created:', match.id);
            } catch (error) {
              console.error('Error creating match:', error);
            }
            break;

          case 'join_match':
            if (!userId || !data.matchId) {
              console.error('Cannot join match: missing required data');
              return;
            }
            console.log('Joining match...', data);
            const game = games.get(data.matchId);
            if (game && game.players.length < data.maxPlayers) {
              game.players.push({
                id: userId,
                username: data.username,
                position: game.players.length,
                pieces: [0, 0, 0, 0]
              });
              broadcastGameState(game);
              console.log(`User ${userId} joined match ${data.matchId}`);
            }
            break;

          case 'roll_dice':
            if (!userId || !data.matchId) {
              console.error('Cannot roll dice: missing required data');
              return;
            }
            console.log('Rolling dice...', data);
            const gameState = games.get(data.matchId);
            if (gameState && gameState.currentTurn === userId) {
              const diceValue = Math.floor(Math.random() * 6) + 1;
              gameState.diceValue = diceValue;
              broadcastGameState(gameState);
              console.log(`User ${userId} rolled ${diceValue}`);
            }
            break;

          case 'move_piece':
            if (!userId || !data.matchId || typeof data.pieceIndex !== 'number') {
              console.error('Cannot move piece: missing required data');
              return;
            }
            console.log('Moving piece...', data);
            const currentGame = games.get(data.matchId);
            if (currentGame && currentGame.currentTurn === userId) {
              const player = currentGame.players.find(p => p.id === userId);
              if (player && currentGame.diceValue !== undefined) {
                const newPosition = player.pieces[data.pieceIndex] + currentGame.diceValue;
                player.pieces[data.pieceIndex] = newPosition;

                if (newPosition >= 56) {
                  currentGame.winner = userId;
                  await handleGameEnd(currentGame);
                } else {
                  const nextPlayerIndex = (currentGame.players.findIndex(p => p.id === userId) + 1) % currentGame.players.length;
                  currentGame.currentTurn = currentGame.players[nextPlayerIndex].id;
                }
                currentGame.diceValue = undefined;
                broadcastGameState(currentGame);
                console.log(`User ${userId} moved piece ${data.pieceIndex} to ${newPosition}`);
              }
            }
            break;
        }
      } catch (error) {
        console.error('Error processing game message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('Game WebSocket error:', error);
    });

    ws.on('close', () => {
      if (userId) {
        connections.delete(userId);
        console.log(`User ${userId} disconnected from game WebSocket`);
      }
    });
  });

  return wss;
}

function broadcastGameState(gameState: GameState) {
  console.log('Broadcasting game state:', gameState);
  gameState.players.forEach(player => {
    const connection = connections.get(player.id);
    if (connection?.readyState === WebSocket.OPEN) {
      connection.send(JSON.stringify({
        type: 'game_state_update',
        gameState
      }));
    }
  });
}

async function handleGameEnd(gameState: GameState) {
  if (!gameState.winner) return;

  const match = await storage.getMatch(gameState.matchId);
  if (!match) return;

  const totalPrize = parseFloat(match.betAmount) * gameState.players.length;
  const winnerPrize = totalPrize * 0.9; // 90% to winner
  const platformFee = totalPrize * 0.1; // 10% platform fee

  await storage.updateMatchWinner(match.id, gameState.winner);
  await storage.createTransaction({
    userId: gameState.winner,
    type: 'win',
    amount: winnerPrize.toString(),
    status: 'approved',
    orderId: null
  });

  // Handle referral commission if applicable
  const winner = await storage.getUser(gameState.winner);
  if (winner?.referredBy) {
    const referralCommission = platformFee * 0.5; // 50% of platform fee
    await storage.createTransaction({
      userId: winner.referredBy,
      type: 'referral',
      amount: referralCommission.toString(),
      status: 'approved',
      orderId: null
    });
  }
}