import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

export interface WalletTransaction {
  id: string;
  type: 'deposit' | 'purchase' | 'refund' | 'cashback';
  title: string;
  amount: number;
  date: string;
  method: string;
  orderId?: string | undefined;
  status: 'Completed' | 'Pending';
}

interface WalletContextType {
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
  deposit: (amount: number, method: string) => boolean;
  pay: (amount: number, description: string, orderId?: string) => boolean;
  canAfford: (amount: number) => boolean;
  formatAmount: (amount: number) => string;
  resetWallet: () => void;
}

const STORAGE_KEY_BALANCE = 'hasa-wallet-balance-v2';
const STORAGE_KEY_TXNS = 'hasa-wallet-transactions-v2';
const DEFAULT_INITIAL_BALANCE = 5000; // Rs. 5,000 demo credit

const DEFAULT_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'TXN-9041',
    type: 'deposit',
    title: 'Wallet Deposit via Easypaisa',
    amount: 4000,
    date: 'Yesterday, 4:20 PM',
    method: 'Easypaisa',
    status: 'Completed',
  },
  {
    id: 'TXN-9040',
    type: 'cashback',
    title: 'HASA Gold VIP Welcome Bonus',
    amount: 1000,
    date: 'Yesterday, 4:18 PM',
    method: 'HASA Rewards',
    status: 'Completed',
  },
];

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BALANCE);
      if (saved !== null) {
        const parsed = Number(saved);
        if (!isNaN(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_INITIAL_BALANCE;
  });

  const [transactions, setTransactions] = useState<WalletTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TXNS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_TRANSACTIONS;
  });

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BALANCE, balance.toString());
      localStorage.setItem(STORAGE_KEY_TXNS, JSON.stringify(transactions));
    } catch {
      // ignore in incognito/storage failure
    }
  }, [balance, transactions]);

  function formatAmount(amount: number) {
    return `Rs. ${amount.toLocaleString()}`;
  }

  function canAfford(amount: number) {
    return balance >= amount;
  }

  function deposit(amount: number, method: string) {
    if (amount <= 0) {
      toast.error('Deposit amount must be greater than 0.');
      return false;
    }

    const newTxnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTxn: WalletTransaction = {
      id: newTxnId,
      type: 'deposit',
      title: `Wallet Top-Up via ${method}`,
      amount,
      date: 'Just now',
      method,
      status: 'Completed',
    };

    setBalance(prev => prev + amount);
    setTransactions(prev => [newTxn, ...prev]);
    toast.success(`🎉 ${formatAmount(amount)} successfully added to your HASA Wallet via ${method}!`);
    return true;
  }

  function pay(amount: number, description: string, orderId?: string) {
    if (balance < amount) {
      toast.error(`Insufficient wallet balance. You need ${formatAmount(amount)}, but have ${formatAmount(balance)}.`);
      return false;
    }

    const newTxnId = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTxn: WalletTransaction = {
      id: newTxnId,
      type: 'purchase',
      title: description,
      amount: -amount,
      date: 'Just now',
      method: 'HASA Gold Wallet',
      orderId,
      status: 'Completed',
    };

    setBalance(prev => prev - amount);
    setTransactions(prev => [newTxn, ...prev]);
    return true;
  }

  function resetWallet() {
    setBalance(DEFAULT_INITIAL_BALANCE);
    setTransactions(DEFAULT_TRANSACTIONS);
    toast.success('Wallet demo balance reset to Rs. 5,000.');
  }

  return (
    <WalletContext.Provider
      value={{
        balance,
        currency: 'Rs.',
        transactions,
        deposit,
        pay,
        canAfford,
        formatAmount,
        resetWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
