import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useGame } from "@/hooks/use-game";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

export default function LobbyPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { createMatch } = useGame(0);
  const [betAmount, setBetAmount] = useState("");
  const [maxPlayers, setMaxPlayers] = useState<2 | 3 | 4>(2);

  const { data: matches, isLoading } = useQuery({
    queryKey: ["/api/matches"],
  });

  const createMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/matches", {
        betAmount: parseFloat(betAmount),
        maxPlayers,
      });
      return res.json();
    },
    onSuccess: (match) => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      createMatch(parseFloat(betAmount), maxPlayers);
      setLocation(`/game/${match.id}`);
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Game Lobby</h1>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create Match</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Match</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createMatchMutation.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-sm font-medium">Bet Amount (USDT)</label>
                  <Input
                    type="number"
                    min="0.2"
                    max="1000"
                    step="0.1"
                    value={betAmount}
                    onChange={(e) => setBetAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Number of Players</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[2, 3, 4].map((num) => (
                      <Button
                        key={num}
                        type="button"
                        variant={maxPlayers === num ? "default" : "outline"}
                        onClick={() => setMaxPlayers(num as 2 | 3 | 4)}
                      >
                        {num} Players
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createMatchMutation.isPending}
                >
                  {createMatchMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Match
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : matches?.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground p-8">
              No active matches. Create one to start playing!
            </div>
          ) : (
            matches?.map((match: any) => (
              <Card key={match.id}>
                <CardHeader>
                  <CardTitle>Match #{match.id}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Bet Amount:</span>
                      <span>{match.betAmount} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Players:</span>
                      <span>
                        {match.players?.length || 1}/{match.maxPlayers}
                      </span>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setLocation(`/game/${match.id}`)}
                      disabled={match.creatorId === user?.id}
                    >
                      {match.creatorId === user?.id
                        ? "Your Match"
                        : "Join Match"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
