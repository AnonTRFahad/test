import { useParams } from "wouter";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import GameBoard from "@/components/game-board";
import { Loader2, Dice6 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function GamePage() {
  const { id } = useParams();
  const matchId = parseInt(id);
  const { user } = useAuth();
  const { gameState, rollDice, movePiece } = useGame(matchId);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const currentPlayer = gameState.players.find((p) => p.id === gameState.currentTurn);
  const isMyTurn = currentPlayer?.id === user?.id;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl">
        <div className="grid md:grid-cols-[1fr_300px] gap-8">
          <div>
            <GameBoard
              gameState={gameState}
              onPieceClick={(pieceIndex) => isMyTurn && movePiece(pieceIndex)}
            />
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Players</h2>
                <div className="space-y-2">
                  {gameState.players.map((player) => (
                    <div
                      key={player.id}
                      className={`p-2 rounded-lg ${
                        player.id === gameState.currentTurn
                          ? "bg-primary/10 border border-primary"
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{player.username}</span>
                        <span className="text-sm text-muted-foreground">
                          {player.pieces.filter((p) => p >= 56).length}/4 Home
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {isMyTurn && !gameState.diceValue && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => rollDice()}
              >
                <Dice6 className="mr-2 h-4 w-4" />
                Roll Dice
              </Button>
            )}

            {gameState.diceValue && (
              <div className="text-center">
                <div className="text-4xl font-bold mb-2">{gameState.diceValue}</div>
                <p className="text-sm text-muted-foreground">
                  {isMyTurn
                    ? "Click on a piece to move"
                    : `Waiting for ${currentPlayer?.username} to move`}
                </p>
              </div>
            )}

            {gameState.winner && (
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-bold text-center text-green-600">
                    {gameState.winner === user?.id ? "You Won!" : "Game Over"}
                  </h2>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
