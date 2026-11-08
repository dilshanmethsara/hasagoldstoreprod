import { createContext, useContext, useState, type ReactNode } from "react";
import { useWalletData } from "@/lib/firestore";
import type { OrderDoc, WalletAdjustmentDoc, WalletDepositDoc } from "@/lib/firestore-schema";

export interface WalletTransaction {
  id: string;
  referenceNumber: string;
  type: "deposit" | "adjustment" | "purchase";
  title: string;
  amount: number;
  date: string;
  createdAt: number | null;
  method: string;
  status: "Completed" | "Pending" | "Failed";
  reason?: string;
}

interface WalletContextType {
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
  formatAmount: (amount: number) => string;
  isLoaded: boolean;
  error: string | null;
  historyError: string | null;
}

function formatTs(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)
    return `Today, ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

function depositDocToTransaction(deposit: WalletDepositDoc): WalletTransaction {
  return {
    id: deposit.depositId,
    referenceNumber: deposit.referenceNumber ?? "",
    type: "deposit",
    title: `${deposit.method === "ezcash" ? "eZ Cash" : deposit.method} wallet deposit`,
    amount: deposit.status === "credited" ? deposit.creditedLkr : 0,
    date: formatTs(deposit.createdAt),
    createdAt: deposit.createdAt,
    method: deposit.method === "ezcash" ? "eZ Cash" : deposit.method,
    status:
      deposit.status === "credited"
        ? "Completed"
        : deposit.status === "failed"
          ? "Failed"
          : "Pending",
  };
}

function adjustmentDocToTransaction(adjustment: WalletAdjustmentDoc): WalletTransaction {
  return {
    id: adjustment.adjustmentId,
    referenceNumber: "",
    type: "adjustment",
    title: adjustment.amountLkr > 0 ? "Admin credit" : "Admin deduction",
    amount: adjustment.amountLkr,
    date: formatTs(adjustment.createdAt),
    createdAt: adjustment.createdAt,
    method: "Admin adjustment",
    status: "Completed",
    reason: adjustment.reason,
  };
}

function orderDocToTransaction(order: OrderDoc): WalletTransaction | null {
  if (order.paymentMethod !== "wallet") return null;
  const rawOrder = order as unknown as Record<string, unknown>;
  const resolvedId = String(order.orderId || rawOrder.id || "");
  return {
    id: resolvedId,
    referenceNumber: resolvedId,
    type: "purchase",
    title: `${order.gameName || "Game"} top-up`,
    amount: -order.pricePkr,
    date: formatTs(order.createdAt),
    createdAt: order.createdAt,
    method: "Wallet payment",
    status: "Completed",
    reason: order.packageName,
  };
}

const DEFAULT_WALLET_VALUE: WalletContextType = {
  balance: 0,
  currency: "Rs.",
  transactions: [],
  formatAmount: (amount: number) => `Rs. ${amount.toLocaleString()}`,
  isLoaded: false,
  error: null,
  historyError: null,
};

const WalletContext = createContext<WalletContextType>(DEFAULT_WALLET_VALUE);

export function WalletProvider({ children, uid }: { children: ReactNode; uid?: string | null }) {
  const { data, isLoading, error } = useWalletData(uid);
  const balance = data?.balance ?? 0;
  const deposits = data?.deposits ?? [];
  const adjustments = data?.adjustments ?? [];
  const orders = data?.orders ?? [];

  const transactions = [
    ...deposits.map(depositDocToTransaction),
    ...adjustments.map(adjustmentDocToTransaction),
    ...orders.map(orderDocToTransaction).filter((transaction) => transaction !== null),
  ].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const formatAmount = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <WalletContext.Provider
      value={{
        balance,
        currency: "Rs.",
        transactions,
        formatAmount,
        isLoaded: !isLoading,
        error: error ? "Wallet data could not be loaded. Check your connection and retry." : null,
        historyError: null,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  return context ?? DEFAULT_WALLET_VALUE;
}
