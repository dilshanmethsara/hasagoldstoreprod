import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  subscribeWalletAdjustments,
  subscribeWalletBalance,
  subscribeWalletDeposits,
  subscribeWalletOrders,
} from "@/lib/firestore";
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
  return {
    id: order.orderId,
    referenceNumber: order.orderId,
    type: "purchase",
    title: `${order.gameName} top-up`,
    amount: -order.pricePkr,
    date: formatTs(order.createdAt),
    createdAt: order.createdAt,
    method: "Wallet payment",
    status: "Completed",
    reason: order.packageName,
  };
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children, uid }: { children: ReactNode; uid?: string | null }) {
  const [balance, setBalance] = useState(0);
  const [deposits, setDeposits] = useState<WalletDepositDoc[]>([]);
  const [adjustments, setAdjustments] = useState<WalletAdjustmentDoc[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    setHistoryError(null);
    setBalance(0);
    setDeposits([]);
    setAdjustments([]);
    setOrders([]);
    if (!uid) {
      setIsLoaded(true);
      return;
    }

    setIsLoaded(false);
    let balanceReady = false;
    let depositsReady = false;
    let adjustmentsReady = false;
    let ordersReady = false;
    const setLoadError = (cause: Error, source: "balance" | "history") => {
      console.error(`Could not load wallet ${source}:`, cause);
      const errorCode = (cause as Error & { code?: string }).code;
      const message =
        errorCode === "permission-denied"
          ? source === "balance"
            ? "Firestore denied wallet balance access. Confirm the signed-in UID and deploy the owner-only Firestore rules."
            : "Firestore denied wallet history access. Deploy the updated Firestore rules, including wallet adjustment access."
          : errorCode === "failed-precondition"
            ? "Wallet data needs a Firestore index. Deploy the indexes from firestore.indexes.json."
            : `Wallet ${source} could not be loaded. Check your connection and retry.`;
      if (source === "balance") {
        setError(message);
        balanceReady = true;
      } else {
        setHistoryError(message);
      }
      if (depositsReady && adjustmentsReady && ordersReady && balanceReady) setIsLoaded(true);
    };
    const onBalance = (value: number) => {
      setBalance(value);
      balanceReady = true;
      if (depositsReady && adjustmentsReady && ordersReady) setIsLoaded(true);
    };
    const onDeposits = (value: WalletDepositDoc[]) => {
      setDeposits(value);
      depositsReady = true;
      if (balanceReady && adjustmentsReady && ordersReady) setIsLoaded(true);
    };
    const onAdjustments = (value: WalletAdjustmentDoc[]) => {
      setAdjustments(value);
      adjustmentsReady = true;
      if (balanceReady && depositsReady && ordersReady) setIsLoaded(true);
    };
    const onOrders = (value: OrderDoc[]) => {
      setOrders(value);
      ordersReady = true;
      if (balanceReady && depositsReady && adjustmentsReady) setIsLoaded(true);
    };
    const onBalanceError = (cause: Error) => setLoadError(cause, "balance");
    const onDepositsError = (cause: Error) => {
      depositsReady = true;
      setLoadError(cause, "history");
    };
    const onAdjustmentsError = (cause: Error) => {
      adjustmentsReady = true;
      setLoadError(cause, "history");
    };
    const onOrdersError = (cause: Error) => {
      ordersReady = true;
      setLoadError(cause, "history");
    };
    const unsubscribeBalance = subscribeWalletBalance(uid, onBalance, onBalanceError);
    const unsubscribeDeposits = subscribeWalletDeposits(uid, onDeposits, onDepositsError);
    const unsubscribeAdjustments = subscribeWalletAdjustments(
      uid,
      onAdjustments,
      onAdjustmentsError,
    );
    const unsubscribeOrders = subscribeWalletOrders(uid, onOrders, onOrdersError);
    return () => {
      unsubscribeBalance();
      unsubscribeDeposits();
      unsubscribeAdjustments();
      unsubscribeOrders();
    };
  }, [uid]);

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
        isLoaded,
        error,
        historyError,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within a WalletProvider");
  return context;
}
