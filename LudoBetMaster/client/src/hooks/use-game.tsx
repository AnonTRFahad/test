import { useEffect, useState } from "react";
import { GameState } from "@shared/schema";
import { useAuth } from "./use-auth";

export function useGame(matchId: number) {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<WebSocket | null>(null);

  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/game`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Game WebSocket connected');
      ws.send(JSON.stringify({ type: "join", userId: user.id }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Game message received:', data);

        if (data.type === "game_state_update") {
          setGameState(data.gameState);
        }
      } catch (error) {
        console.error('Error processing game message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Game WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Game WebSocket disconnected, attempting to reconnect...');
      setTimeout(() => {
        setSocket(null);
      }, 3000);
    };

    setSocket(ws);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [user, matchId]);

  const createMatch = (betAmount: number, maxPlayers: number) => {
    if (socket?.readyState === WebSocket.OPEN && user) {
      console.log('Creating match...', { betAmount, maxPlayers });
      socket.send(
        JSON.stringify({
          type: "create_match",
          userId: user.id,
          username: user.username,
          betAmount,
          maxPlayers,
        })
      );
    } else {
      console.error('Cannot create match: socket not ready or user not logged in');
    }
  };

  const joinMatch = (matchId: number, maxPlayers: number) => {
    if (socket?.readyState === WebSocket.OPEN && user) {
      console.log('Joining match...', { matchId, maxPlayers });
      socket.send(
        JSON.stringify({
          type: "join_match",
          userId: user.id,
          username: user.username,
          matchId,
          maxPlayers,
        })
      );
    } else {
      console.error('Cannot join match: socket not ready or user not logged in');
    }
  };

  const rollDice = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      console.log('Rolling dice...');
      socket.send(
        JSON.stringify({
          type: "roll_dice",
          userId: user?.id,
          matchId,
        })
      );
    } else {
      console.error('Cannot roll dice: socket not ready');
    }
  };

  const movePiece = (pieceIndex: number) => {
    if (socket?.readyState === WebSocket.OPEN) {
      console.log('Moving piece...', { pieceIndex });
      socket.send(
        JSON.stringify({
          type: "move_piece",
          userId: user?.id,
          matchId,
          pieceIndex,
        })
      );
    } else {
      console.error('Cannot move piece: socket not ready');
    }
  };

  return {
    gameState,
    createMatch,
    joinMatch,
    rollDice,
    movePiece,
  };
}