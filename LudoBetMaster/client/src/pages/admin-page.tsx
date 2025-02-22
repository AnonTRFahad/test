// client/src/pages/admin-page.tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Loader2, Trash2, Users, History } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useEffect } from "react";

// Type definitions for Transaction and User
interface Transaction {
  id: number;
  type: "deposit" | "withdrawal";
  userId: number;
  amount: number;
  status: "pending" | "approved" | "rejected";
  orderId?: string;
  created: string; // Assuming this is a date string
}

interface User {
  id: number;
  username: string;
  balance: number;
  referralCode: string;
  referredBy?: string;
}


export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();

  const { data: transactions = [], isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions"],
    enabled: isVerified,
  });

  const { data: allTransactions = [], isLoading: isLoadingHistory } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/transactions/all"],
    enabled: isVerified,
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: isVerified,
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!isVerified) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "transaction_update":
          // Update both transaction lists
          queryClient.setQueryData(
            ["/api/admin/transactions"],
            (old: Transaction[] = []) => {
              if (data.transaction.status !== "pending") {
                return old.filter((tx) => tx.id !== data.transaction.id);
              }
              const index = old.findIndex((tx) => tx.id === data.transaction.id);
              if (index === -1 && data.transaction.status === "pending") {
                return [...old, data.transaction];
              }
              return [
                ...old.slice(0, index),
                data.transaction,
                ...old.slice(index + 1),
              ];
            }
          );

          queryClient.setQueryData(
            ["/api/admin/transactions/all"],
            (old: Transaction[] = []) => {
              const index = old.findIndex((tx) => tx.id === data.transaction.id);
              if (index === -1) {
                return [...old, data.transaction];
              }
              return [
                ...old.slice(0, index),
                data.transaction,
                ...old.slice(index + 1),
              ];
            }
          );
          break;

        case "transaction_deleted":
          // Remove from both lists
          queryClient.setQueryData(
            ["/api/admin/transactions"],
            (old: Transaction[] = []) =>
              old.filter((tx) => tx.id !== data.transactionId)
          );
          queryClient.setQueryData(
            ["/api/admin/transactions/all"],
            (old: Transaction[] = []) =>
              old.filter((tx) => tx.id !== data.transactionId)
          );
          break;

        case "user_update":
          queryClient.setQueryData(
            ["/api/admin/users"],
            (old: User[] = []) => {
              const index = old.findIndex((u) => u.id === data.user.id);
              if (index === -1) return old;
              return [
                ...old.slice(0, index),
                data.user,
                ...old.slice(index + 1),
              ];
            }
          );
          break;
      }
    };

    return () => ws.close();
  }, [isVerified]);

  const verifyPinMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/verify", { pin });
    },
    onSuccess: () => {
      setIsVerified(true);
    },
    onError: () => {
      toast({
        title: "Invalid PIN",
        description: "Please try again with the correct PIN",
        variant: "destructive",
      });
    },
  });

  const handleTransaction = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: number;
      action: "approve" | "reject" | "delete";
    }) => {
      await apiRequest("POST", `/api/admin/transactions/${id}/${action}`);
    },
  });

  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <CardTitle>Admin Verification</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPinMutation.mutate();
              }}
              className="space-y-4"
            >
              <Input
                type="password"
                placeholder="Enter Admin PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={verifyPinMutation.isPending}
              >
                {verifyPinMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Admin Panel</h1>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">
              Pending Transactions
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Transaction History
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle>Pending Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingTransactions ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !transactions || transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No pending transactions
                  </p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {tx.type === "deposit" ? "Deposit" : "Withdrawal"} Request
                          </p>
                          <p className="text-sm text-muted-foreground">
                            User ID: {tx.userId}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Amount: {tx.amount} USDT
                          </p>
                          {tx.orderId && (
                            <p className="text-sm text-muted-foreground">
                              Order ID: {tx.orderId}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() =>
                              handleTransaction.mutate({
                                id: tx.id,
                                action: "approve",
                              })
                            }
                            disabled={handleTransaction.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleTransaction.mutate({
                                id: tx.id,
                                action: "reject",
                              })
                            }
                            disabled={handleTransaction.isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleTransaction.mutate({
                                id: tx.id,
                                action: "delete",
                              })
                            }
                            disabled={handleTransaction.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !allTransactions || allTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No transaction history
                  </p>
                ) : (
                  <div className="space-y-4">
                    {allTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-4 bg-muted rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            User ID: {tx.userId}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Amount: {tx.amount} USDT
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Status: {tx.status}
                          </p>
                          {tx.orderId && (
                            <p className="text-sm text-muted-foreground">
                              Order ID: {tx.orderId}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Date: {new Date(tx.created).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleTransaction.mutate({
                              id: tx.id,
                              action: "delete",
                            })
                          }
                          disabled={handleTransaction.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center p-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : !users || users.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No users found
                  </p>
                ) : (
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="p-4 bg-muted rounded-lg"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-medium">Username: {user.username}</p>
                            <p className="text-sm text-muted-foreground">
                              Balance: {user.balance} USDT
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Referral Code: {user.referralCode}
                            </p>
                            {user.referredBy && (
                              <p className="text-sm text-muted-foreground">
                                Referred By: {user.referredBy}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}