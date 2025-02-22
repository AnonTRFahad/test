import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { useToast } from '@/hooks/use-toast';

export function useWebSocket() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!user) return;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        // Send join message with user ID
        if (user?.id) {
          ws.send(JSON.stringify({ type: 'join', userId: user.id }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);

          switch (data.type) {
            case "user_update":
              queryClient.setQueryData(["/api/user"], data.user);
              break;

            case "transaction_update":
              // Update transactions list
              queryClient.setQueryData(
                ["/api/transactions"],
                (old: any[] = []) => {
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

              // Show toast notification
              if (data.transaction.status === 'approved' || data.transaction.status === 'rejected') {
                toast({
                  title: `Transaction ${data.transaction.status}`,
                  description: `Your ${data.transaction.type} request has been ${data.transaction.status}.`,
                  variant: data.transaction.status === 'approved' ? 'default' : 'destructive',
                });
              }
              break;

            case "transaction_deleted":
              queryClient.setQueryData(
                ["/api/transactions"],
                (old: any[] = []) =>
                  old.filter((tx) => tx.id !== data.transactionId)
              );
              break;

            case "match_update":
              // Update matches list
              queryClient.setQueryData(
                ["/api/matches"],
                (old: any[] = []) => {
                  const index = old.findIndex((m) => m.id === data.match.id);
                  if (index === -1) {
                    return [...old, data.match];
                  }
                  return [
                    ...old.slice(0, index),
                    data.match,
                    ...old.slice(index + 1),
                  ];
                }
              );
              break;
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: "Connection Error",
          description: "There was an error with the real-time connection. Attempting to reconnect...",
          variant: "destructive",
        });
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected, attempting to reconnect...');
        // Set up reconnection timeout
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [user, queryClient, toast]);
}