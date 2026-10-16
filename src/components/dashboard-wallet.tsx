import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, Coins, Sparkles, ShieldCheck, RefreshCw, Zap, CheckCircle2, Loader2, Wallet, Plus, CreditCard, Smartphone, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useDemoAccount } from './demo-account';
import { useWallet } from './wallet-context';

export function DashboardWallet() {
  const { balance, formatAmount, transactions, deposit, resetWallet } = useWallet();
  const { user } = useDemoAccount();
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [depositMethod, setDepositMethod] = useState<string>('ezcash');
  const [depositing, setDepositing] = useState(false);

  const presetAmounts = [500, 1000, 2500, 5000, 10000];
  const depositMethods = [
    { id: 'ezcash', name: 'eZ Cash (EZ Cash)', sub: 'Instant Mobile PIN Gateway · 0% Fee', icon: <Smartphone size={28} /> },
    { id: 'easypaisa', name: 'Easypaisa', sub: 'Instant Mobile Account · 0% Fee', icon: <Smartphone size={28} /> },
    { id: 'jazzcash', name: 'JazzCash', sub: 'Fast Mobile Wallet · 0% Fee', icon: <Smartphone size={28} /> },
    { id: 'card', name: 'Visa / Mastercard', sub: '3D Secure Instant Load', icon: <CreditCard size={28} /> },
  ];

  function handleDeposit(e: FormEvent) {
    e.preventDefault();
    const finalAmount = customAmount ? Number(customAmount) : depositAmount;
    if (isNaN(finalAmount) || finalAmount <= 0) {
      toast.error('Please select or enter a valid deposit amount.');
      return;
    }
    setDepositing(true);
    setTimeout(() => {
      const selected = depositMethods.find(m => m.id === depositMethod);
      deposit(finalAmount, selected?.name || 'Mobile Gateway');
      setDepositing(false);
      setCustomAmount('');
    }, 700);
  }

  function getTxTypeClass(type: string) {
    switch (type) {
      case 'deposit': return 'is-deposit';
      case 'purchase': return 'is-purchase';
      case 'cashback': return 'is-cashback';
      case 'refund': return 'is-refund';
      default: return 'is-deposit';
    }
  }

  return (
    <>
      <div className="dashboard-heading">
        <span className="eyebrow">SAMPLE · YOUR ACCOUNT</span>
        <h1>HASA Gold Wallet.</h1>
        <p>Your in-game payment vault. 1-Click checkout, 0% platform fee, and instant refunds.</p>
      </div>

      {/* VIP Card */}
      <div className="wallet-card-container">
        <div className="wallet-vip-card">
          <div className="wallet-card-header">
            <div>
              <div className="wallet-badges">
                <span className="wallet-vip-badge"><Sparkles size={12} /> VIP TIER 1</span>
                <span className="wallet-active-badge">● Active</span>
              </div>
              <h2 className="wallet-balance-label">AVAILABLE BALANCE</h2>
              <div className="wallet-balance-amount">{formatAmount(balance)}</div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
              <div className="wallet-card-chip">
                <div className="chip-line" />
                <div className="chip-line" />
                <div className="chip-line" />
              </div>
              <span className="wallet-brand">HASA GOLD</span>
            </div>
          </div>

          <div className="wallet-card-footer">
            <div>
              <div className="wallet-cardholder-label">Cardholder</div>
              <div className="wallet-cardholder-name">{user?.name?.toUpperCase() || 'VALUED HASA VIP'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="wallet-id-label">Instant Dispatch ID</div>
              <div className="wallet-id-number">•••• 8892</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Reset demo */}
      <div className="wallet-info-row">
        <div className="wallet-info-text">
          <ShieldCheck size={16} style={{ color: 'var(--gold)' }} />
          <span>Real-time balance sync across Checkout, Games, and Account.</span>
        </div>
        <Button variant="ghost" size="sm" onClick={resetWallet} style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
          <RefreshCw size={13} style={{ marginRight: '6px' }} />
          Reset Demo to Rs. 5,000
        </Button>
      </div>

      {/* Top-Up / Deposit Section */}
      <section className="dashboard-section">
        <div className="wallet-section-header">
          <div className="wallet-section-icon">
            <Coins size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '19px', margin: 0, fontWeight: 800 }}>Top-Up Wallet Balance</h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted-foreground)', marginTop: '4px' }}>
              Add credits instantly using eZ Cash, Easypaisa, JazzCash, or Debit Card.
            </p>
          </div>
        </div>

        <form onSubmit={handleDeposit} className="wallet-deposit-form">
          {/* Preset Buttons */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              1. Select Deposit Amount
            </label>
            <div className="wallet-amount-grid">
              {presetAmounts.map((amt) => {
                const isSelected = !customAmount && depositAmount === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      setDepositAmount(amt);
                      setCustomAmount('');
                    }}
                    className={`wallet-amount-btn ${isSelected ? 'is-selected' : ''}`}
                  >
                    Rs. {amt.toLocaleString()}
                  </button>
                );
              })}
            </div>

            <div className="wallet-custom-amount-row">
              <label>Or custom amount:</label>
              <input
                type="number"
                placeholder="e.g. 3500"
                min="100"
                step="50"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="wallet-custom-amount-input"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              2. Deposit Payment Gateway
            </label>
            <div className="wallet-method-grid">
              {depositMethods.map((m) => {
                const isSelected = depositMethod === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setDepositMethod(m.id)}
                    className={`wallet-method-card ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div className="wallet-method-icon">{m.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong className="wallet-method-name">{m.name}</strong>
                        {isSelected && <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />}
                      </div>
                      <div className="wallet-method-sub">{m.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deposit Button */}
          <button
            type="submit"
            disabled={depositing}
            className="wallet-deposit-btn"
          >
            {depositing ? (
              <>
                <Loader2 className="loading-spin" size={18} />
                Authorizing Deposit...
              </>
            ) : (
              <>
                <Zap size={18} />
                Confirm Deposit of {formatAmount(customAmount ? Number(customAmount) : depositAmount)}
              </>
            )}
          </button>
        </form>
      </section>

      {/* Transaction History */}
      <section className="dashboard-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '19px', fontWeight: 800, margin: 0 }}>
            Wallet Transaction Ledger
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>
            {transactions.length} transactions
          </span>
        </div>

        {/* Transaction Summary Stats */}
        {transactions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '4px' }}>Total Deposits</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>
                {formatAmount(transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0))}
              </div>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '4px' }}>Total Spent</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--foreground)', fontFamily: 'var(--font-display)' }}>
                {formatAmount(Math.abs(transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)))}
              </div>
            </div>
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', fontWeight: 600, marginBottom: '4px' }}>Net Change</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-display)' }}>
                {formatAmount(transactions.reduce((sum, t) => sum + t.amount, 0))}
              </div>
            </div>
          </div>
        )}

        {transactions.length ? (
          <div className="wallet-tx-grid">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              const typeClass = getTxTypeClass(tx.type);
              return (
                <div key={tx.id} className="wallet-tx-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className={`wallet-tx-icon ${typeClass}`}>
                      {tx.type === 'deposit' && <ArrowDownLeft size={22} />}
                      {tx.type === 'purchase' && <Zap size={20} />}
                      {tx.type === 'cashback' && <TrendingUp size={20} />}
                      {tx.type === 'refund' && <Plus size={20} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <strong className="wallet-tx-title">{tx.title}</strong>
                        <span className={`wallet-tx-badge ${typeClass}`}>{tx.type}</span>
                      </div>
                      <div className="wallet-tx-meta">
                        <code>{tx.id}</code> · {tx.method} · {tx.date}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', minWidth: '120px' }}>
                    <div className={`wallet-tx-amount ${isPositive ? 'is-positive' : 'is-negative'}`}>
                      {isPositive ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount)}
                    </div>
                    <div className="wallet-tx-status">{tx.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty">
            <Wallet />
            <h2>No transactions recorded</h2>
            <p>Your wallet ledger is fresh. Top up credits or place game orders to see activity.</p>
          </div>
        )}
      </section>
    </>
  );
}
