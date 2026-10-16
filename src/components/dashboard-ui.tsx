import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { LayoutGrid, Receipt, IdCard, Heart, UserRound, Settings, ArrowUpRight, Plus, Pencil, Trash2, Save, Loader2, Wallet, Coins, Sparkles, ShieldCheck, ArrowDownLeft, Zap, CheckCircle2, RefreshCw, CreditCard, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { games } from '@/lib/store-data';
import { GameGrid, EmptyState } from './store-ui';
import { useStore } from './store-context';
import { useDemoAccount } from './demo-account';
import { FormField, PasswordField } from './account-ui';
import { useAdmin } from './admin-context';
import { useWallet } from './wallet-context';

const links = [
  { to: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { to: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { to: '/dashboard/orders', label: 'Orders', icon: Receipt },
  { to: '/dashboard/players', label: 'Player IDs', icon: IdCard },
  { to: '/dashboard/favorites', label: 'Favorites', icon: Heart },
  { to: '/dashboard/profile', label: 'Profile', icon: UserRound },
  { to: '/dashboard/settings', label: 'Settings', icon: Settings },
] as const;

const mobileLinks = [
  { to: '/dashboard', label: 'Overview', icon: LayoutGrid },
  { to: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
  { to: '/dashboard/orders', label: 'Orders', icon: Receipt },
  { to: '/dashboard/players', label: 'Player IDs', icon: IdCard },
  { to: '/dashboard/settings', label: 'More', icon: Settings },
] as const;
export function DashboardSkeleton() { return <div className="container dashboard-skeleton" aria-label="Loading dashboard" aria-busy="true"><div className="skeleton skeleton-title"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-block"/></div>; }
export function DashboardLayout() {
  const { ready, user } = useDemoAccount(); const { pathname } = useLocation(); const navigate = useNavigate();
  useEffect(() => { if (ready && !user && pathname.startsWith('/dashboard')) navigate({ to: '/login', search: { redirect: pathname }, replace: true }); }, [ready, user, pathname, navigate]);
  if (!ready || !user) return <DashboardSkeleton/>;
  return <div className="container dashboard-layout"><aside className="dashboard-sidebar"><span className="eyebrow">YOUR SPACE</span><div className="sidebar-profile"><span className="user-avatar">{user.name.slice(0,1).toUpperCase()}</span><div><strong>{user.name}</strong><small>Sample · Local account</small></div></div><nav aria-label="Dashboard navigation">{links.map(item => <Button key={item.to} asChild variant="ghost"><Link to={item.to} activeOptions={{ exact: true }} activeProps={{ className: 'is-active', 'aria-current': 'page' }} viewTransition><item.icon/><span>{item.label}</span></Link></Button>)}<Button asChild variant="ghost"><Link to="/support"><ArrowUpRight/><span>Support</span></Link></Button></nav></aside><section className="dashboard-main"><Outlet/></section><nav className="dashboard-tabs" aria-label="Dashboard tabs">{mobileLinks.map(item => <Button key={item.to} asChild variant="ghost"><Link to={item.to} activeOptions={{ exact: true }} activeProps={{ className: 'is-active', 'aria-current': 'page' }} viewTransition><item.icon/><span>{item.label}</span></Link></Button>)}</nav></div>;
}
function Heading({ title, description }: { title: string; description: string }) { return <div className="dashboard-heading"><span className="eyebrow">SAMPLE · YOUR ACCOUNT</span><h1>{title}</h1><p>{description}</p></div>; }
export function DashboardOverview() {
  const { user } = useDemoAccount(); const { favorites } = useStore();
  const favoriteGames = games.filter(game => favorites.includes(game.id)); const recent = (user?.recent || []).flatMap(id => { const game = games.find(item => item.id === id); return game ? [game] : []; });
  return <><Heading title={`Welcome, ${user?.name || 'player'}.`} description="A little space for the games you love."/><div className="quick-actions"><Button asChild><Link to="/games">Explore games <ArrowUpRight/></Link></Button><Button asChild variant="outline"><Link to="/dashboard/players"><IdCard/>Player IDs</Link></Button><Button asChild variant="outline"><Link to="/support">Support <ArrowUpRight/></Link></Button></div><section className="dashboard-section"><h2>Favorite games</h2>{favoriteGames.length ? <GameGrid items={favoriteGames}/> : <EmptyState favorite/>}</section><section className="dashboard-section"><h2>Recently viewed</h2>{recent.length ? <GameGrid items={recent}/> : <div className="dashboard-empty"><LayoutGrid/><h3>No games viewed yet</h3><p>Your recently visited game pages will appear here.</p><Button asChild variant="outline"><Link to="/games">Browse games <ArrowUpRight/></Link></Button></div>}</section></>;
}
export function DashboardOrders() {
  const { orders } = useAdmin();
  return (
    <>
      <Heading
        title="Your orders."
        description="Review all your instant top-up deliveries, character receipts, and order statuses."
      />
      {orders.length ? (
        <div className="orders-table-wrapper" style={{ marginTop: '20px' }}>
          <div className="orders-card-grid" style={{ display: 'grid', gap: '14px' }}>
            {orders.map((ord) => (
              <div
                key={ord.id}
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px' }}>{ord.item}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: ord.status === 'Completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: ord.status === 'Completed' ? '#10b981' : '#f59e0b',
                          fontWeight: 700,
                        }}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                      Ref: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ord.id}</span> · Recipient: <strong>{ord.customerName}</strong> {ord.playerId ? `(${ord.playerId})` : ''} · {ord.paymentMethod}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--foreground)' }}>
                      {ord.amount}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
                      {ord.date}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/games">
                      Top-Up Again <ArrowUpRight size={13} />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="dashboard-empty">
          <Receipt />
          <h2>No orders yet</h2>
          <p>You haven't placed any in-game top-ups yet. Choose a game to recharge instantly!</p>
          <Button asChild variant="outline">
            <Link to="/games">
              Explore game top-ups <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
export function DashboardWallet() {
  const { balance, formatAmount, transactions, deposit, resetWallet } = useWallet();
  const { user } = useDemoAccount();
  const [depositAmount, setDepositAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [depositMethod, setDepositMethod] = useState<string>('ezcash');
  const [depositing, setDepositing] = useState(false);

  const presetAmounts = [500, 1000, 2500, 5000, 10000];
  const depositMethods = [
    { id: 'ezcash', name: 'eZ Cash (EZ Cash)', sub: 'Instant Mobile PIN Gateway · 0% Fee', icon: '📱' },
    { id: 'easypaisa', name: 'Easypaisa', sub: 'Instant Mobile Account · 0% Fee', icon: '⚡' },
    { id: 'jazzcash', name: 'JazzCash', sub: 'Fast Mobile Wallet · 0% Fee', icon: '🔥' },
    { id: 'card', name: 'Visa / Mastercard', sub: '3D Secure Instant Load', icon: '💳' },
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
      <Heading
        title="HASA Gold Wallet."
        description="Your in-game payment vault. 1-Click checkout, 0% platform fee, and instant refunds."
      />

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
      <section className="dashboard-section" style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Coins size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', margin: 0, fontWeight: 800 }}>Top-Up Wallet Balance</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted-foreground)' }}>
              Add credits instantly using eZ Cash, Easypaisa, JazzCash, or Debit Card.
            </p>
          </div>
        </div>

        <form onSubmit={handleDeposit} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          {/* Preset Buttons */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              1. Select Deposit Amount
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
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
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #f59e0b' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'var(--background)',
                      color: isSelected ? '#f59e0b' : 'var(--foreground)',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'center',
                    }}
                  >
                    Rs. {amt.toLocaleString()}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>Or custom amount:</span>
              <input
                type="number"
                placeholder="e.g. 3500"
                min="100"
                step="50"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                style={{
                  width: '140px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              2. Deposit Payment Gateway
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {depositMethods.map((m) => {
                const isSelected = depositMethod === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setDepositMethod(m.id)}
                    style={{
                      padding: '14px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #10b981' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(16, 185, 129, 0.07)' : 'var(--background)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <span style={{ fontSize: '24px' }}>{m.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <strong style={{ fontSize: '13px', color: isSelected ? '#10b981' : 'var(--foreground)' }}>
                          {m.name}
                        </strong>
                        {isSelected && <CheckCircle2 size={16} color="#10b981" />}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                        {m.sub}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deposit Button */}
          <Button
            type="submit"
            disabled={depositing}
            style={{
              width: '100%',
              height: '46px',
              borderRadius: '12px',
              fontSize: '15px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#ffffff',
              boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
              cursor: 'pointer',
            }}
          >
            {depositing ? (
              <>
                <Loader2 className="loading-spin" size={18} style={{ marginRight: '8px' }} />
                Authorizing Deposit...
              </>
            ) : (
              <>
                <Zap size={18} style={{ marginRight: '8px' }} />
                Confirm Deposit of {formatAmount(customAmount ? Number(customAmount) : depositAmount)}
              </>
            )}
          </Button>
        </form>
      </section>

      {/* Transaction History */}
      <section className="dashboard-section" style={{ marginTop: '28px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px' }}>
          Wallet Transaction Ledger
        </h2>
        {transactions.length ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: isPositive ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isPositive ? <ArrowDownLeft size={20} /> : <Zap size={18} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '13px' }}>{tx.title}</strong>
                        <span
                          style={{
                            fontSize: '10px',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: isPositive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: isPositive ? '#10b981' : '#3b82f6',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}
                        >
                          {tx.type}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                        Ref: <span style={{ fontFamily: 'monospace' }}>{tx.id}</span> · Method: {tx.method} · {tx.date}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 900,
                        color: isPositive ? '#10b981' : 'var(--foreground)',
                      }}
                    >
                      {isPositive ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount)}
                    </div>
                    <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 600 }}>
                      ● {tx.status}
                    </div>
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
export function DashboardFavorites() { const { favorites } = useStore(); const items = games.filter(game => favorites.includes(game.id)); return <><Heading title="Your favorites." description="Saved games for this browsing session."/>{items.length ? <GameGrid items={items}/> : <EmptyState favorite/>}</>; }
export function DashboardPlayers() {
  const { user, update } = useDemoAccount(); const [editing, setEditing] = useState<string | null>(null); const [deleting, setDeleting] = useState<string | null>(null); const [value, setValue] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); const result = z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9 _#.-]+$/).safeParse(value); if (!result.success) { setError('Use 1–64 letters, numbers, spaces, or _ # . -'); return; } if (!user || !editing) return; setBusy(true); await new Promise(resolve => setTimeout(resolve,250)); update({ players: { ...user.players, [editing]: result.data } }); setBusy(false); setEditing(null); toast.success('Sample Player ID saved'); }
  return <><Heading title="Saved Player IDs." description="Keep sample IDs handy. Stored on this device only; never enter passwords."/><div className="player-list">{games.map(game => <article className="player-row" key={game.id}><img src={game.image} alt={`Sample ${game.name} artwork`}/><div><h2>{game.name}</h2><p>{user?.players[game.id] ? `Sample · ${user.players[game.id]}` : 'No Player ID saved'}</p></div><Button variant="outline" size="icon" aria-label={`${user?.players[game.id] ? 'Edit' : 'Add'} ${game.name} Player ID`} title="Add or edit Player ID" onClick={() => { setEditing(game.id); setValue(user?.players[game.id] || ''); setError(''); }}>{user?.players[game.id] ? <Pencil/> : <Plus/>}</Button>{user?.players[game.id] && <Button variant="ghost" size="icon" aria-label={`Delete ${game.name} Player ID`} title="Delete Player ID" onClick={() => setDeleting(game.id)}><Trash2/></Button>}</article>)}</div><Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent><DialogTitle>Sample Player ID</DialogTitle><DialogDescription>{games.find(game => game.id === editing)?.name} · Saved on this device only.</DialogDescription><form className="account-form" onSubmit={submit}><div className="form-field"><label htmlFor="player-id">Player ID</label><input id="player-id" maxLength={64} value={value} onChange={e => setValue(e.target.value)} aria-invalid={Boolean(error)} aria-describedby="player-error" autoFocus/>{error && <p id="player-error" className="field-error">{error}</p>}</div><Button type="submit" disabled={busy}>{busy ? <Loader2 className="loading-spin"/> : <Save/>}Save ID</Button></form></DialogContent></Dialog><Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }}><DialogContent><DialogTitle>Delete saved ID?</DialogTitle><DialogDescription>This removes the sample ID from this device.</DialogDescription><Button variant="destructive" onClick={() => { if (!user || !deleting) return; const players = { ...user.players }; delete players[deleting]; update({ players }); setDeleting(null); toast.success('Player ID deleted'); }}>Delete ID <Trash2/></Button></DialogContent></Dialog></>;
}
export function DashboardProfile() {
  const { user, update } = useDemoAccount(); const [errors, setErrors] = useState<Record<string,string>>({}); const [busy, setBusy] = useState(false); const [passwordBusy, setPasswordBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const name = String(data.get('name') || '').trim(); const email = String(data.get('email') || '').trim().toLowerCase(); const next: Record<string,string> = {}; if (!name) next['name'] = 'Enter your name.'; if (!z.string().email().max(254).safeParse(email).success) next['email'] = 'Enter a valid email.'; setErrors(next); if (Object.keys(next).length) return; setBusy(true); await new Promise(resolve => setTimeout(resolve,250)); if (update({ name, email })) toast.success('Demo profile updated'); else setErrors({ email: 'This email already belongs to another local profile.' }); setBusy(false); }
  async function password(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const value = String(data.get('new-password') || ''); if (value.length < 8) { setErrors({ 'new-password': 'Use at least 8 characters.' }); return; } if (value !== data.get('confirm-new')) { setErrors({ 'confirm-new': 'The passwords do not match.' }); return; } setErrors({}); setPasswordBusy(true); await new Promise(resolve => setTimeout(resolve,250)); setPasswordBusy(false); form.reset(); toast.info('Demo preview complete. No password was stored or changed.'); }
  return <><Heading title="Your profile." description="A name and email, saved only on this device."/><form className="settings-form" onSubmit={save} noValidate><FormField label="Name" name="name" value={user?.name} error={errors['name']}/><FormField label="Email" name="email" type="email" value={user?.email} error={errors['email']}/><Button disabled={busy} type="submit">{busy ? <Loader2 className="loading-spin"/> : <Save/>}Save profile</Button></form><section className="dashboard-section"><h2>Password preview</h2><p className="form-hint">Demo only. Passwords are never verified, stored, or changed. Do not use a real password.</p><form className="settings-form" onSubmit={password} noValidate><PasswordField label="New password" name="new-password" hint error={errors['new-password']}/><PasswordField label="Confirm new password" name="confirm-new" error={errors['confirm-new']}/><Button type="submit" variant="outline" disabled={passwordBusy}>{passwordBusy && <Loader2 className="loading-spin"/>}Preview password change</Button></form></section></>;
}
export function DashboardSettings() { const { user, update, theme, setTheme } = useDemoAccount(); return <><Heading title="Just your style." description="Make this space feel like you."/><section className="dashboard-section"><h2>Appearance</h2><div className="theme-segment" role="group" aria-label="Theme preference">{(['light','dark','system'] as const).map(value => <Button key={value} variant={theme === value ? 'default' : 'ghost'} aria-pressed={theme === value} onClick={() => { setTheme(value); toast.success('Theme updated'); }}>{value.charAt(0).toUpperCase() + value.slice(1)}</Button>)}</div><p className="form-hint">System follows your device. Your choice is remembered.</p></section><section className="dashboard-section"><h2>Notifications</h2><p className="form-hint">Sample preferences only. No notifications or emails are sent.</p>{([{ key: 'updates', title: 'Store updates' }, { key: 'reminders', title: 'Game reminders' }] as const).map(item => <label className="setting-row" key={item.key}><span>{item.title}</span><input type="checkbox" role="switch" checked={user?.notifications[item.key] || false} onChange={e => { if (user) update({ notifications: { ...user.notifications, [item.key]: e.target.checked } }); toast.success('Sample preference saved'); }}/></label>)}</section></>; }