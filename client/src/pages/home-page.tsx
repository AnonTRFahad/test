import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LogOut, Wallet, Loader2 } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["/api/transactions"],
  });

  // Initialize WebSocket connection
  useWebSocket();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user?.username}!</h1>
            <p className="text-muted-foreground">
              Your Balance: {user?.balance} USDT
            </p>
          </div>
          <Button variant="outline" onClick={() => logoutMutation.mutate()}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/lobby">
                <Button className="w-full">Play Now</Button>
              </Link>
              <Link href="/wallet">
                <Button variant="outline" className="w-full">
                  <Wallet className="w-4 h-4 mr-2" />
                  Wallet
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline" className="w-full">
                  Admin Panel
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Referral</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-mono mb-2">{user?.referralCode}</p>
              <p className="text-sm text-muted-foreground">
                Share this code to earn 5% commission on platform fees
              </p>
              {user?.referredBy && (
                <p className="text-sm text-muted-foreground mt-2">
                  Referred by: User #{user.referredBy}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !transactions || transactions.length === 0 ? (
                <p className="text-muted-foreground text-center">
                  No recent transactions
                </p>
              ) : (
                <div className="space-y-2">
                  {(transactions as any[])?.slice(0, 5).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex justify-between items-center text-sm"
                    >
                      <div>
                        <span className="capitalize">{tx.type}</span>
                        <span className={`text-xs ml-2 ${
                          tx.status === 'approved' 
                            ? 'text-green-600' 
                            : tx.status === 'rejected'
                            ? 'text-red-600'
                            : 'text-muted-foreground'
                        }`}>
                          ({tx.status})
                        </span>
                      </div>
                      <span
                        className={
                          tx.type === "withdrawal"
                            ? "text-destructive"
                            : "text-green-600"
                        }
                      >
                        {tx.type === "withdrawal" ? "-" : "+"}
                        {tx.amount} USDT
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}