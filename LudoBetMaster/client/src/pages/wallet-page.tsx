import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function WalletPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState("");

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "user_update") {
        queryClient.setQueryData(["/api/user"], data.user);
      }
    };

    return () => ws.close();
  }, [user]);

  const depositMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/transactions", {
        type: "deposit",
        amount,
        orderId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Deposit Request Submitted",
        description: "Your deposit request is being processed by admin.",
      });
      setAmount("");
      setOrderId("");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/transactions", {
        type: "withdrawal",
        amount,
        orderId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Withdrawal Request Submitted",
        description: "Your withdrawal request is being processed by admin.",
      });
      setAmount("");
      setOrderId("");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Wallet</h1>
          <p className="text-muted-foreground">
            Current Balance: {user?.balance} USDT
          </p>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Deposit / Withdraw</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="deposit">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit">Deposit</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="deposit">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    depositMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium">Amount (USDT)</label>
                    <Input
                      type="number"
                      min="0.2"
                      step="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Transaction ID / Order ID
                    </label>
                    <Input
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      required
                      placeholder="Enter your USDT transaction ID"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={depositMutation.isPending}
                  >
                    {depositMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Deposit Request
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="withdraw">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    withdrawMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-sm font-medium">Amount (USDT)</label>
                    <Input
                      type="number"
                      min="0.2"
                      max={parseFloat(user?.balance || "0")}
                      step="0.1"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">
                      Your USDT Pay ID
                    </label>
                    <Input
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      required
                      placeholder="Enter your USDT Pay ID"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      withdrawMutation.isPending ||
                      parseFloat(amount) > parseFloat(user?.balance || "0")
                    }
                  >
                    {withdrawMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Withdrawal Request
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}