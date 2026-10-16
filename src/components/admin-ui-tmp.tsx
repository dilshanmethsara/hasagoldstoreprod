import { useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from '@tanstack/react-router';
import {
  LayoutGrid, Gamepad2, Diamond, Users, Receipt, HelpCircle, Settings2,
  ArrowUpRight, Search, Pencil, Trash2, Plus, X, Menu, Save, ShieldCheck,
  Activity, RotateCcw, Download, CheckCircle2, AlertTriangle, Clock,
  Server, Radio, FileText, ExternalLink, Eye, Tag, Send, MessageSquare,
  Filter, DollarSign, Layers, SlidersHorizontal, RefreshCw, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Brand } from './store-ui';
import { ThemeMenu } from './account-menu';
import { useDemoAccount } from './demo-account';
import {
  AdminProvider, useAdmin,
  type AdminGame, type AdminAccountListing, type AdminOrder,
  type AdminService, type AdminTicket
} from './admin-context';

const nav = [
  { to: '/admin',           label: 'Overview',        icon: LayoutGrid   },
  { to: '/admin/games',     label: 'Games',            icon: Gamepad2     },
  { to: '/admin/packages',  label: 'Packages',         icon: Diamond      },
  { to: '/admin/accounts',  label: 'Marketplace',      icon: Users        },
  { to: '/admin/orders',    label: 'Orders',           icon: Receipt      },
  { to: '/admin/support',   label: 'Support & FAQs',   icon: HelpCircle   },
  { to: '/admin/settings',  label: 'Settings',         icon: Settings2    },
] as const;

export function AdminLayout() { return <AdminProvider><AdminShell /></AdminProvider>; }

function AdminShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const current = nav.find(item => item.to === pathname);
  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <Brand />
          <Button variant="ghost" size="icon" className="admin-close" aria-label="Close admin navigation" onClick={() => setOpen(false)}><X /></Button>
        </div>
        <div className="admin-workspace">
          <span className="admin-workspace-icon"><ShieldCheck /></span>
          <div><strong>Store workspace</strong><small>Sample · Frontend demo</small></div>
        </div>
        <span className="admin-nav-caption">MANAGEMENT</span>
        <nav aria-label="Admin navigation">
          {nav.map(item => (
            <Button asChild variant="ghost" key={item.to}>
              <Link to={item.to} activeOptions={{ exact: true }} activeProps={{ className: 'is-active', 'aria-current': 'page' }} onClick={() => setOpen(false)} viewTransition>
                <item.icon /><span>{item.label}</span>
              </Link>
            </Button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <p>No live services connected</p>
          <Button asChild variant="outline"><Link to="/">View storefront <ArrowUpRight /></Link></Button>
        </div>
      </aside>
      {open && <Button className="admin-backdrop" variant="ghost" aria-label="Dismiss admin navigation" onClick={() => setOpen(false)} />}
      <div className="admin-body">
        <header className="admin-topbar">
          <Button variant="ghost" size="icon" className="admin-menu" aria-label="Open admin navigation" onClick={() => setOpen(true)}><Menu /></Button>
          <div className="admin-breadcrumb">Workspace <span>/</span><strong>{current?.label || 'Overview'}</strong></div>
          <div className="admin-topbar-tools">
            <span className="admin-badge">Sample</span>
            <ThemeMenu />
            <Button asChild variant="outline" className="admin-store-link"><Link to="/">Storefront <ArrowUpRight /></Link></Button>
          </div>
        </header>
        <main id="main-content" className="admin-main">
          <div className="admin-notice"><ShieldCheck size={16} /><span>Public admin demo · No secure access or live changes. Draft edits last for this admin visit.</span></div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AdminHeading({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="admin-heading">
      <div><span className="eyebrow">HASA GOLD · STORE MANAGEMENT</span><h1>{title}</h1><p>{description}</p></div>
      {children}
    </div>
  );
}

function Empty({ icon: Icon, title, description }: { icon: typeof Receipt; title: string; description: string }) {
  return <div className="admin-empty"><Icon /><h2>{title}</h2><p>{description}</p></div>;
}

function PillBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Completed: 'pill-success', Available: 'pill-success', operational: 'pill-success', Open: 'pill-info',
    Processing: 'pill-info', Reserved: 'pill-warning', degraded: 'pill-warning', 'In Progress': 'pill-info',
    Pending: 'pill-warning', maintenance: 'pill-warning', Sold: 'pill-muted', Resolved: 'pill-muted',
    Refunded: 'pill-muted', outage: 'pill-danger',
  };
  return <span className={`admin-pill ${map[status] || 'pill-muted'}`}>{status}</span>;
}

// ─── OVERVIEW ────────────────────────────────────────────────────
export function AdminOverview() {
  const { catalog, answers, activity, accounts, orders, services, incidents } = useAdmin();
  const { profiles } = useDemoAccount();
  const operationalCount = services.filter(s => s.status === 'operational').length;
  const openIncidents = incidents.filter(i => i.status !== 'Resolved').length;
  const pendingOrders = orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length;

  const metrics = [
    { label: 'Catalog Games',       value: catalog.length,     icon: Gamepad2,       detail: `${catalog.filter(g => g.enabled).length} enabled` },
    { label: 'Top-up Packages',     value: catalog.reduce((n, g) => n + g.packs.length, 0), icon: Diamond, detail: 'Sample amounts' },
    { label: 'Marketplace Accounts',value: accounts.length,    icon: Layers,         detail: `${accounts.filter(a => a.status === 'Available').length} available` },
    { label: 'Pending Orders',       value: pendingOrders,      icon: Receipt,        detail: `${orders.length} total orders` },
    { label: 'Services Online',      value: `${operationalCount}/${services.length}`, icon: Server, detail: 'Live service monitors' },
    { label: 'Open Incidents',       value: openIncidents,      icon: AlertTriangle,  detail: openIncidents === 0 ? 'All systems stable' : 'Needs attention' },
    { label: 'Support FAQs',         value: answers.length,     icon: HelpCircle,     detail: 'Draft support content' },
    { label: 'Local Profiles',       value: profiles.length,    icon: Users,          detail: 'On this device only' },
  ];

  const quickActions = [
    { to: '/admin/games',    label: 'Manage Games',           icon: Gamepad2   },
    { to: '/admin/packages', label: 'Edit Packages',          icon: Diamond    },
    { to: '/admin/accounts', label: 'Marketplace Listings',   icon: Layers     },
    { to: '/admin/orders',   label: 'Review Orders',          icon: Receipt    },
    { to: '/admin/support',  label: 'Support Tickets & FAQs', icon: MessageSquare },
    { to: '/admin/settings', label: 'Store Settings',         icon: SlidersHorizontal },
    { to: '/status',         label: 'Public Status Page',     icon: Radio      },
    { to: '/privacy-policy', label: 'Privacy Policy',         icon: FileText   },
    { to: '/refund-policy',  label: 'Refund Policy',          icon: FileText   },
  ];

  return (
    <>
      <AdminHeading title="Store overview" description="A complete view of your sample HASA GOLD STORE workspace." />

      {/* Live status bar */}
      <div className="admin-status-bar-widget">
        <div className="admin-status-left">
          <div className="admin-pulse-dot" />
          <div>
            <strong style={{ fontSize: 14 }}>{openIncidents === 0 ? 'All Systems Operational' : `${openIncidents} Active Incident${openIncidents > 1 ? 's' : ''}`}</strong>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Last checked: just now</p>
          </div>
        </div>
        <div className="admin-status-pills-row">
          <span className="admin-status-chip"><span className="chip-dot" />Top-ups</span>
          <span className="admin-status-chip"><span className="chip-dot" />Payments</span>
          <span className="admin-status-chip"><span className="chip-dot" />Escrow</span>
          <span className="admin-status-chip"><span className="chip-dot" />CDN</span>
        </div>
        <Button asChild variant="outline" style={{ fontSize: 11 }}>
          <Link to="/status">Full status page <ArrowUpRight size={14} /></Link>
        </Button>
      </div>

      {/* Metrics grid */}
      <div className="admin-metrics" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))' }}>
        {metrics.map(item => (
          <article key={item.label} className="admin-metric">
            <span className="admin-metric-icon"><item.icon /></span>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      {/* Quick actions */}
      <section className="admin-section">
        <div className="admin-section-heading"><h2>Quick actions</h2></div>
        <div className="admin-quick-actions">
          {quickActions.map(a => (
            <Link key={a.to} to={a.to} className="admin-quick-btn">
              <a.icon />{a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Game collection + activity */}
      <div className="admin-overview-bottom">
        <section className="admin-section">
          <div className="admin-section-heading">
            <h2>Game collection</h2>
            <Button asChild variant="link"><Link to="/admin/games">Manage games <ArrowUpRight /></Link></Button>
          </div>
          <div className="admin-game-tiles">
            {catalog.map(game => (
              <Link to="/admin/packages" key={game.id} className="admin-game-tile">
                <img src={game.image} alt={`Sample ${game.name} artwork`} />
                <div>
                  <span className="admin-badge">Sample</span>
                  <h3>{game.name}</h3>
                  <p>{game.packs.length} packages · {game.currency}</p>
                </div>
                <ArrowUpRight />
              </Link>
            ))}
          </div>
        </section>
        <section className="admin-section">
          <div className="admin-section-heading">
            <h2>Workspace activity</h2>
            <Activity size={18} />
          </div>
          {activity.length ? (
            <ul className="admin-activity">
              {activity.map((text, i) => <li key={i}><span className="sample-dot" />{text}</li>)}
            </ul>
          ) : (
            <Empty icon={Activity} title="A fresh workspace" description="Draft changes during this visit will appear here." />
          )}
        </section>
      </div>

      {/* Recent orders preview */}
      <section className="admin-section">
        <div className="admin-section-heading">
          <h2>Recent orders</h2>
          <Button asChild variant="link"><Link to="/admin/orders">View all orders <ArrowUpRight /></Link></Button>
        </div>
        <div className="admin-table-container">
          <table className="admin-data-table">
            <thead><tr>
              <th>Order ID</th><th>Customer</th><th>Item</th><th>Amount</th><th>Status</th><th>Date</th>
            </tr></thead>
            <tbody>
              {orders.slice(0, 5).map(o => (
                <tr key={o.id}>
                  <td><span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', fontSize: 11 }}>{o.id}</span></td>
                  <td>{o.customerName}</td>
                  <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.item}</td>
                  <td><strong>{o.amount}</strong></td>
                  <td><PillBadge status={o.status} /></td>
                  <td style={{ color: 'var(--muted-foreground)' }}>{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

// ─── GAMES ───────────────────────────────────────────────────────
export function AdminGames() {
  const { catalog, changeGame } = useAdmin();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<AdminGame | null>(null);
  const [error, setError] = useState('');
  const items = catalog.filter(game =>
    `${game.name} ${game.currency}`.toLowerCase().includes(query.toLowerCase()) &&
    (filter === 'all' || game.enabled === (filter === 'enabled'))
  );
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const data = new FormData(e.currentTarget);
    const result = z.object({ name: z.string().trim().min(1).max(60), currency: z.string().trim().min(1).max(30) }).safeParse({ name: data.get('name'), currency: data.get('currency') });
    if (!result.success) { setError('Enter a game name and currency.'); return; }
    changeGame(editing.id, result.data); setEditing(null); toast.success('Sample game draft saved');
  }
  return (
    <>
      <AdminHeading title="Games" description="Manage the four game drafts without changing the live storefront." />
      <div className="admin-toolbar">
        <div className="search-field"><Search size={18} /><input aria-label="Search admin games" placeholder="Search games or currency…" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select aria-label="Filter game status" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All statuses</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option>
        </select>
        <span>{items.length} games</span>
      </div>
      <div className="admin-table" role="table" aria-label="Sample games">
        <div className="admin-table-head" role="row"><span>Game</span><span>Packages</span><span>Draft status</span><span>Actions</span></div>
        {items.map(game => (
          <div className="admin-table-row" role="row" key={game.id}>
            <div className="admin-game-cell">
              <img src={game.image} alt="Sample artwork" />
              <div><strong>{game.name}</strong><small>{game.currency} · Sample</small></div>
            </div>
            <span>{game.packs.length} packages</span>
            <label className="admin-status-toggle">
              <input type="checkbox" role="switch" aria-label={`${game.name} enabled`} checked={game.enabled} onChange={e => { changeGame(game.id, { enabled: e.target.checked }); toast.success('Draft status updated'); }} />
              <span>{game.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
            <Button variant="ghost" size="icon" aria-label={`Edit ${game.name}`} onClick={() => { setEditing(game); setError(''); }}><Pencil /></Button>
          </div>
        ))}
      </div>
      {!items.length && <Empty icon={Search} title="No matching games" description="Try a different name or status." />}
      <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogTitle>Edit sample game</DialogTitle>
          <DialogDescription>Draft only. No live game listing changes.</DialogDescription>
          <form onSubmit={save} className="account-form">
            <label className="form-field">Game name<input name="name" defaultValue={editing?.name} maxLength={60} /></label>
            <label className="form-field">Currency<input name="currency" defaultValue={editing?.currency} maxLength={30} /></label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit"><Save />Save draft</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── PACKAGES ────────────────────────────────────────────────────
export function AdminPackages() {
  const { catalog, changeGame } = useAdmin();
  const [gameId, setGameId] = useState(catalog[0]?.id || '');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [remove, setRemove] = useState<number | null>(null);
  const game = catalog.find(g => g.id === gameId);
  function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!game) return;
    const amount = Number(new FormData(e.currentTarget).get('amount'));
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000) { setError('Enter a whole amount between 1 and 1,000,000.'); return; }
    if (game.packs.includes(amount) && amount !== editing) { setError('This sample amount already exists.'); return; }
    changeGame(game.id, { packs: (editing === 'new' ? [...game.packs, amount] : game.packs.map(n => n === editing ? amount : n)).sort((a, b) => a - b) });
    setEditing(null); toast.success('Sample package saved');
  }
  return (
    <>
      <AdminHeading title="Top-up packages" description="Sample amounts only. Prices and payments remain unavailable.">
        <Button onClick={() => { setEditing('new'); setError(''); }}><Plus />Add sample package</Button>
      </AdminHeading>
      <div className="admin-game-selector" role="group" aria-label="Choose package game">
        {catalog.map(g => (
          <Button key={g.id} variant={g.id === gameId ? 'default' : 'outline'} onClick={() => setGameId(g.id)}>
            <img src={g.image} alt="" />{g.name}
          </Button>
        ))}
      </div>
      <div className="admin-package-grid">
        {game?.packs.map(amount => (
          <article className="admin-package" key={amount}>
            <span className="admin-badge">Sample</span>
            <Diamond />
            <h2>{amount.toLocaleString()} <small>{game.currency}</small></h2>
            <p>Price not available</p>
            <div>
              <Button variant="outline" aria-label={`Edit ${amount} package`} onClick={() => { setEditing(amount); setError(''); }}><Pencil />Edit</Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${amount} package`} onClick={() => setRemove(amount)}><Trash2 /></Button>
            </div>
          </article>
        ))}
      </div>
      {!game?.packs.length && <Empty icon={Diamond} title="No sample packages" description="Add an amount to this game draft." />}
      <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogTitle>{editing === 'new' ? 'Add' : 'Edit'} sample package</DialogTitle>
          <DialogDescription>{game?.name} · {game?.currency}. No price is assigned.</DialogDescription>
          <form onSubmit={save} className="account-form">
            <label className="form-field">Currency amount<input name="amount" type="number" min={1} max={1000000} step={1} defaultValue={typeof editing === 'number' ? editing : undefined} /></label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit"><Save />Save package</Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={remove !== null} onOpenChange={open => { if (!open) setRemove(null); }}>
        <DialogContent>
          <DialogTitle>Delete sample package?</DialogTitle>
          <DialogDescription>This only removes the amount from your admin draft.</DialogDescription>
          <Button variant="destructive" onClick={() => { if (game) { changeGame(game.id, { packs: game.packs.filter(n => n !== remove) }); toast.success('Sample package deleted'); } setRemove(null); }}><Trash2 />Delete package</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── MARKETPLACE ACCOUNTS ─────────────────────────────────────────
export function AdminAccounts() {
  const { accounts, changeAccountStatus, removeAccount, record } = useAdmin();
  const [query, setQuery] = useState('');
  const [gameFilter, setGameFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [removing, setRemoving] = useState<string | null>(null);
  const [viewing, setViewing] = useState<AdminAccountListing | null>(null);

  const items = accounts.filter(a => {
    const matchQ = `${a.title} ${a.gameName} ${a.rank}`.toLowerCase().includes(query.toLowerCase());
    const matchG = gameFilter === 'all' || a.gameId === gameFilter;
    const matchS = statusFilter === 'all' || a.status === statusFilter;
    return matchQ && matchG && matchS;
  });

  const uniqueGames = Array.from(new Set(accounts.map(a => a.gameId))).map(id => ({ id, name: accounts.find(a => a.gameId === id)!.gameName }));

  return (
    <>
      <AdminHeading title="Game Accounts Marketplace" description="Manage premium account listings. Status changes are demo-only and do not affect the live storefront." />

      {/* Toolbar */}
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="search-field"><Search size={18} /><input aria-label="Search accounts" placeholder="Search title, game, rank…" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select aria-label="Filter by game" value={gameFilter} onChange={e => setGameFilter(e.target.value)}>
          <option value="all">All games</option>
          {uniqueGames.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="Available">Available</option>
          <option value="Reserved">Reserved</option>
          <option value="Sold">Sold</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{items.length} listing{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Account cards grid */}
      {items.length ? (
        <div className="admin-acc-grid">
          {items.map(acc => (
            <div className="admin-acc-card" key={acc.id}>
              <div className="admin-acc-media">
                <img src={acc.image} alt={acc.title} />
                <div className="admin-acc-top-badges">
                  <PillBadge status={acc.status} />
                  {acc.verified && <span className="admin-pill pill-success">Verified</span>}
                </div>
                <span className="admin-acc-price-badge">{acc.priceSample}</span>
              </div>
              <div className="admin-acc-body">
                <p className="admin-acc-title">{acc.title}</p>
                <div className="admin-acc-meta-grid">
                  <div><span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Game</span><br /><strong>{acc.gameName}</strong></div>
                  <div><span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Rank</span><br /><strong>{acc.rank}</strong></div>
                  <div><span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Level</span><br /><strong>{acc.level}</strong></div>
                  <div><span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Server</span><br /><strong>{acc.server}</strong></div>
                </div>
                <div className="admin-acc-actions">
                  <select
                    aria-label={`Change status for ${acc.title}`}
                    value={acc.status}
                    onChange={e => { changeAccountStatus(acc.id, e.target.value as any); toast.success(`Status updated to ${e.target.value}`); }}
                    style={{ fontSize: 11, borderRadius: 6, border: '1px solid var(--border)', padding: '4px 8px', background: 'var(--muted)', color: 'var(--foreground)', cursor: 'pointer' }}
                  >
                    <option value="Available">Available</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Sold">Sold</option>
                  </select>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button variant="ghost" size="icon" aria-label={`View ${acc.title}`} title="View details" onClick={() => setViewing(acc)}><Eye /></Button>
                    <Button asChild variant="ghost" size="icon" aria-label={`Open ${acc.title} page`} title="View storefront page"><Link to={`/accounts/${acc.id}` as any}><ExternalLink /></Link></Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${acc.title}`} title="Remove listing" onClick={() => setRemoving(acc.id)}><Trash2 /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={Layers} title="No matching accounts" description="Try a different search, game, or status filter." />
      )}

      {/* View details dialog */}
      <Dialog open={Boolean(viewing)} onOpenChange={open => { if (!open) setViewing(null); }}>
        <DialogContent>
          <DialogTitle>{viewing?.title}</DialogTitle>
          <DialogDescription>{viewing?.tagline}</DialogDescription>
          {viewing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <img src={viewing.image} alt={viewing.title} style={{ borderRadius: 8, height: 140, objectFit: 'cover', width: '100%' }} />
              <div className="admin-acc-meta-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--muted)', borderRadius: 8, padding: 12 }}>
                {viewing.features.map(f => (
                  <div key={f.label}><span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{f.label}</span><br /><strong style={{ fontSize: 12 }}>{f.value}</strong></div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Inventory Highlights</p>
                <ul style={{ fontSize: 11, paddingLeft: 16, lineHeight: 1.8, color: 'var(--muted-foreground)' }}>
                  {viewing.inventoryHighlights.map((h, i) => <li key={i}>{h}</li>)}
                </ul>
              </div>
              <Button asChild variant="outline" style={{ fontSize: 11 }}>
                <Link to={`/accounts/${viewing.id}` as any}>View storefront listing <ExternalLink size={14} /></Link>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Remove confirm dialog */}
      <Dialog open={removing !== null} onOpenChange={open => { if (!open) setRemoving(null); }}>
        <DialogContent>
          <DialogTitle>Remove listing?</DialogTitle>
          <DialogDescription>This removes the account from your admin workspace. The storefront is not affected.</DialogDescription>
          <Button variant="destructive" onClick={() => { if (removing) { removeAccount(removing); toast.success('Listing removed from workspace'); } setRemoving(null); }}><Trash2 />Remove listing</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── ORDERS ──────────────────────────────────────────────────────
export function AdminOrders() {
  const { orders, updateOrderStatus } = useAdmin();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const items = orders.filter(o => {
    const matchQ = `${o.id} ${o.customerName} ${o.item}`.toLowerCase().includes(query.toLowerCase());
    const matchT = typeFilter === 'all' || o.type === typeFilter;
    const matchS = statusFilter === 'all' || o.status === statusFilter;
    return matchQ && matchT && matchS;
  });

  const totalRevenue = orders.filter(o => o.status === 'Completed').reduce((sum, o) => {
    const val = parseFloat(o.amount.replace(/[^0-9.]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <>
      <AdminHeading title="Orders" description="Sample order history — demonstrates top-up and account purchase management." />

      {/* Summary stats */}
      <div className="admin-metrics" style={{ gridTemplateColumns: 'repeat(4,minmax(0,1fr))', marginBottom: 24 }}>
        {[
          { label: 'Total Orders',      value: orders.length,                                    icon: Receipt,       detail: 'All time sample' },
          { label: 'Completed',         value: orders.filter(o => o.status === 'Completed').length, icon: CheckCircle2, detail: 'Successfully delivered' },
          { label: 'Processing',        value: orders.filter(o => o.status === 'Processing' || o.status === 'Pending').length, icon: Clock, detail: 'Awaiting action' },
          { label: 'Sample Revenue',    value: `$${totalRevenue.toFixed(2)}`,                    icon: DollarSign,    detail: 'Completed orders only' },
        ].map(item => (
          <article key={item.label} className="admin-metric">
            <span className="admin-metric-icon"><item.icon /></span>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="search-field"><Search size={18} /><input aria-label="Search orders" placeholder="Search order ID, customer, item…" value={query} onChange={e => setQuery(e.target.value)} /></div>
        <select aria-label="Filter by type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="topup">Top-up</option>
          <option value="account">Account sale</option>
        </select>
        <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="Completed">Completed</option>
          <option value="Processing">Processing</option>
          <option value="Pending">Pending</option>
          <option value="Refunded">Refunded</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>{items.length} order{items.length !== 1 ? 's' : ''}</span>
      </div>

      {items.length ? (
        <div className="admin-table-container">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Player ID / Note</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map(o => (
                <tr key={o.id}>
                  <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{o.id}</span></td>
                  <td><span className={`admin-pill ${o.type === 'topup' ? 'pill-info' : 'pill-warning'}`} style={{ fontSize: 9 }}>{o.type === 'topup' ? 'Top-up' : 'Account'}</span></td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{o.customerName}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{o.customerContact}</div>
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{o.item}</td>
                  <td><strong style={{ fontSize: 13 }}>{o.amount}</strong></td>
                  <td style={{ fontSize: 11 }}>{o.paymentMethod}</td>
                  <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{o.playerId || '—'}</td>
                  <td><PillBadge status={o.status} /></td>
                  <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{o.date}</td>
                  <td>
                    <select
                      aria-label={`Change status for ${o.id}`}
                      value={o.status}
                      onChange={e => { updateOrderStatus(o.id, e.target.value as any); toast.success(`Order ${o.id} → ${e.target.value}`); }}
                      style={{ fontSize: 10, borderRadius: 5, border: '1px solid var(--border)', padding: '4px 6px', background: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      <option value="Completed">Completed</option>
                      <option value="Processing">Processing</option>
                      <option value="Pending">Pending</option>
                      <option value="Refunded">Refunded</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={Receipt} title="No matching orders" description="Try a different search or filter." />
      )}

      <div className="admin-order-note">
        <ShieldCheck />
        <p>Sample order data only. Real order management and delivery tracking require a connected backend.</p>
      </div>
    </>
  );
}

// ─── SUPPORT & FAQs ──────────────────────────────────────────────
export function AdminSupport() {
  const { answers, setAnswers, record, tickets, updateTicketStatus, replyTicket } = useAdmin();
  const [tab, setTab] = useState<'tickets' | 'faqs'>('tickets');
  const [query, setQuery] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [remove, setRemove] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [viewTicket, setViewTicket] = useState<AdminTicket | null>(null);
  const [replyText, setReplyText] = useState('');

  const filteredFaqs = answers.filter(f =>
    `${f.question} ${f.answer}`.toLowerCase().includes(query.toLowerCase())
  );

  const filteredTickets = tickets.filter(t => {
    const matchQ = `${t.id} ${t.customerName} ${t.subject}`.toLowerCase().includes(query.toLowerCase());
    const matchS = ticketStatusFilter === 'all' || t.status === ticketStatusFilter;
    return matchQ && matchS;
  });

  function priorityClass(p: string) {
    return p === 'High' ? 'pill-danger' : p === 'Normal' ? 'pill-info' : 'pill-muted';
  }

  return (
    <>
      <AdminHeading title="Support & FAQs" description="Manage support ticket queue and FAQ draft content.">
        {tab === 'faqs' && <Button onClick={() => { setEditing('new'); setError(''); }}><Plus />Add FAQ</Button>}
      </AdminHeading>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'tickets' ? 'is-active' : ''}`} onClick={() => setTab('tickets')}>
          <MessageSquare />Tickets <span style={{ fontSize: 10, background: 'var(--muted)', padding: '2px 6px', borderRadius: 10, marginLeft: 4 }}>{tickets.filter(t => t.status !== 'Resolved').length}</span>
        </button>
        <button className={`admin-tab ${tab === 'faqs' ? 'is-active' : ''}`} onClick={() => setTab('faqs')}>
          <HelpCircle />FAQ Library <span style={{ fontSize: 10, background: 'var(--muted)', padding: '2px 6px', borderRadius: 10, marginLeft: 4 }}>{answers.length}</span>
        </button>
      </div>

      {tab === 'tickets' && (
        <>
          <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div className="search-field"><Search size={18} /><input aria-label="Search tickets" placeholder="Search ticket ID, customer, subject…" value={query} onChange={e => setQuery(e.target.value)} /></div>
            <select aria-label="Filter ticket status" value={ticketStatusFilter} onChange={e => setTicketStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          {filteredTickets.length ? (
            <div className="admin-table-container">
              <table className="admin-data-table">
                <thead><tr>
                  <th>Ticket ID</th><th>Customer</th><th>Subject</th><th>Category</th><th>Priority</th><th>Status</th><th>Date</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {filteredTickets.map(t => (
                    <tr key={t.id}>
                      <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{t.id}</span></td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{t.customerName}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{t.customerEmail}</div>
                      </td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>{t.subject}</td>
                      <td style={{ fontSize: 11 }}>{t.category}</td>
                      <td><span className={`admin-pill ${priorityClass(t.priority)}`}>{t.priority}</span></td>
                      <td><PillBadge status={t.status} /></td>
                      <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{t.date}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button variant="ghost" size="icon" aria-label={`View ticket ${t.id}`} title="View & reply" onClick={() => { setViewTicket(t); setReplyText(''); }}><MessageSquare /></Button>
                          {t.status !== 'Resolved' && (
                            <Button variant="ghost" size="icon" aria-label={`Resolve ticket ${t.id}`} title="Mark resolved" onClick={() => { updateTicketStatus(t.id, 'Resolved'); toast.success(`Ticket ${t.id} resolved`); }}><Check /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon={MessageSquare} title="No matching tickets" description="Try a different search or status filter." />
          )}
        </>
      )}

      {tab === 'faqs' && (
        <>
          <div className="search-field"><Search size={18} /><input aria-label="Search FAQs" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search questions and answers…" /></div>
          <div className="admin-faq-list">
            {filteredFaqs.map((faq, index) => (
              <article key={index}>
                <div><span className="admin-badge">Sample draft</span><h2>{faq.question}</h2><p>{faq.answer}</p></div>
                <div className="admin-faq-actions">
                  <Button variant="ghost" size="icon" aria-label={`Edit FAQ ${index + 1}`} onClick={() => { setEditing(index); setError(''); }}><Pencil /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete FAQ ${index + 1}`} onClick={() => setRemove(index)}><Trash2 /></Button>
                </div>
              </article>
            ))}
          </div>
          {!filteredFaqs.length && <Empty icon={HelpCircle} title="No matching FAQs" description="Try another search or add a draft answer." />}
        </>
      )}

      {/* View/Reply Ticket Dialog */}
      <Dialog open={Boolean(viewTicket)} onOpenChange={open => { if (!open) setViewTicket(null); }}>
        <DialogContent>
          <DialogTitle>{viewTicket?.id} — {viewTicket?.subject}</DialogTitle>
          <DialogDescription>{viewTicket?.category} · Priority: {viewTicket?.priority} · {viewTicket?.date}</DialogDescription>
          <div className="admin-chat-thread">
            {viewTicket?.messages.map((m, i) => (
              <div key={i} className={`admin-msg-bubble ${m.sender === 'Admin Support' ? 'msg-admin' : 'msg-customer'}`}>
                <div className="admin-msg-sender">{m.sender}</div>
                {m.text}
                <div style={{ fontSize: 9, opacity: .7, marginTop: 4 }}>{m.time}</div>
              </div>
            ))}
          </div>
          {viewTicket?.status !== 'Resolved' && (
            <form onSubmit={e => {
              e.preventDefault();
              if (!viewTicket || !replyText.trim()) return;
              replyTicket(viewTicket.id, replyText.trim());
              setViewTicket(prev => prev ? { ...prev, status: 'In Progress', messages: [...prev.messages, { sender: 'Admin Support', text: replyText.trim(), time: 'Just now' }] } : null);
              setReplyText('');
              toast.success('Reply sent');
            }} style={{ display: 'flex', gap: 8 }}>
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply…" rows={2} style={{ flex: 1, fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', padding: '8px 10px', background: 'var(--muted)', color: 'var(--foreground)', resize: 'vertical' }} />
              <Button type="submit" size="icon" disabled={!replyText.trim()} aria-label="Send reply"><Send /></Button>
            </form>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {viewTicket?.status !== 'Resolved' && (
              <Button variant="outline" style={{ fontSize: 11 }} onClick={() => { if (viewTicket) { updateTicketStatus(viewTicket.id, 'Resolved'); setViewTicket(prev => prev ? { ...prev, status: 'Resolved' } : null); toast.success('Ticket resolved'); } }}><Check />Mark Resolved</Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ Edit Dialog */}
      <Dialog open={editing !== null} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogTitle>{editing === 'new' ? 'Add' : 'Edit'} FAQ draft</DialogTitle>
          <DialogDescription>Sample content only.</DialogDescription>
          <form className="account-form" onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const result = z.object({ question: z.string().trim().min(1).max(200), answer: z.string().trim().min(1).max(2000) }).safeParse({ question: data.get('question'), answer: data.get('answer') });
            if (!result.success) { setError('Enter a question (up to 200 chars) and answer (up to 2,000).'); return; }
            setAnswers(editing === 'new' ? [...answers, result.data] : answers.map((f, i) => i === editing ? result.data : f));
            record('Sample FAQ draft saved'); setEditing(null); toast.success('FAQ draft saved');
          }}>
            <label className="form-field">Question<input name="question" maxLength={200} defaultValue={typeof editing === 'number' ? answers[editing]?.question : ''} /></label>
            <label className="form-field">Answer<textarea name="answer" maxLength={2000} rows={5} defaultValue={typeof editing === 'number' ? answers[editing]?.answer : ''} /></label>
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit"><Save />Save FAQ</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* FAQ Delete Dialog */}
      <Dialog open={remove !== null} onOpenChange={open => { if (!open) setRemove(null); }}>
        <DialogContent>
          <DialogTitle>Delete FAQ draft?</DialogTitle>
          <DialogDescription>This does not change the storefront support page.</DialogDescription>
          <Button variant="destructive" onClick={() => { setAnswers(answers.filter((_, i) => i !== remove)); record('FAQ draft deleted'); setRemove(null); toast.success('FAQ draft deleted'); }}><Trash2 />Delete FAQ</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── SETTINGS ────────────────────────────────────────────────────
export function AdminSettings() {
  const { theme, setTheme } = useDemoAccount();
  const { catalog, answers, reset, settings, updateStoreSettings, policies, services, updateServiceStatus, incidents, addIncident, resolveIncident, record } = useAdmin();
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<'store' | 'services' | 'policies' | 'workspace'>('store');
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentNote, setIncidentNote] = useState('');
  const [incidentImpact, setIncidentImpact] = useState<'Minor' | 'Major'>('Minor');
  const [reportOpen, setReportOpen] = useState(false);

  function serviceStatusIcon(status: AdminService['status']) {
    if (status === 'operational') return <CheckCircle2 size={16} style={{ color: 'oklch(.55 .15 145)' }} />;
    if (status === 'degraded') return <AlertTriangle size={16} style={{ color: 'oklch(.65 .16 80)' }} />;
    if (status === 'maintenance') return <RefreshCw size={16} style={{ color: 'var(--primary)' }} />;
    return <AlertTriangle size={16} style={{ color: 'oklch(.55 .2 25)' }} />;
  }

  return (
    <>
      <AdminHeading title="Workspace settings" description="Store info, services monitor, policy metadata, appearance, and workspace reset." />

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'store' ? 'is-active' : ''}`} onClick={() => setTab('store')}><SlidersHorizontal />Store Info</button>
        <button className={`admin-tab ${tab === 'services' ? 'is-active' : ''}`} onClick={() => setTab('services')}><Server />Services & Incidents</button>
        <button className={`admin-tab ${tab === 'policies' ? 'is-active' : ''}`} onClick={() => setTab('policies')}><FileText />Policy Metadata</button>
        <button className={`admin-tab ${tab === 'workspace' ? 'is-active' : ''}`} onClick={() => setTab('workspace')}><Settings2 />Appearance & Reset</button>
      </div>

      {/* ── Store Info ── */}
      {tab === 'store' && (
        <section className="admin-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <p className="form-hint" style={{ marginBottom: 18 }}>Sample store configuration. No changes are pushed to any live system.</p>
          <form className="account-form" onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            updateStoreSettings({
              storeName:       (data.get('storeName') as string).trim(),
              tagline:         (data.get('tagline') as string).trim(),
              supportEmail:    (data.get('supportEmail') as string).trim(),
              supportWhatsapp: (data.get('supportWhatsapp') as string).trim(),
              currency:        (data.get('currency') as string).trim(),
              bannerText:      (data.get('bannerText') as string).trim(),
            });
            toast.success('Store settings saved (demo workspace)');
          }}>
            <div className="admin-form-row">
              <label className="form-field">Store Name<input name="storeName" defaultValue={settings.storeName} maxLength={60} /></label>
              <label className="form-field">Tagline<input name="tagline" defaultValue={settings.tagline} maxLength={100} /></label>
            </div>
            <div className="admin-form-row">
              <label className="form-field">Support Email<input name="supportEmail" type="email" defaultValue={settings.supportEmail} /></label>
              <label className="form-field">WhatsApp Number<input name="supportWhatsapp" defaultValue={settings.supportWhatsapp} /></label>
            </div>
            <div className="admin-form-row">
              <label className="form-field">Display Currency<input name="currency" defaultValue={settings.currency} maxLength={20} /></label>
            </div>
            <label className="form-field">Announcement Banner Text<input name="bannerText" defaultValue={settings.bannerText} maxLength={200} /></label>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.instantEscrowEnabled} onChange={e => updateStoreSettings({ instantEscrowEnabled: e.target.checked })} /> Instant Escrow Enabled
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.bannerEnabled} onChange={e => updateStoreSettings({ bannerEnabled: e.target.checked })} /> Show Announcement Banner
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={settings.maintenanceMode} onChange={e => { updateStoreSettings({ maintenanceMode: e.target.checked }); toast.info(e.target.checked ? 'Maintenance mode ON (demo)' : 'Maintenance mode OFF (demo)'); }} /> Maintenance Mode
              </label>
            </div>
            <Button type="submit" style={{ marginTop: 8 }}><Save />Save store settings</Button>
          </form>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/"><ExternalLink size={14} />View Storefront</Link></Button>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/status"><Radio size={14} />Service Status Page</Link></Button>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/privacy-policy"><FileText size={14} />Privacy Policy</Link></Button>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/refund-policy"><FileText size={14} />Refund Policy</Link></Button>
          </div>
        </section>
      )}

      {/* ── Services & Incidents ── */}
      {tab === 'services' && (
        <section className="admin-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <div className="admin-section-heading">
            <h2>Service monitors <span style={{ fontSize: 11, color: 'var(--muted-foreground)', fontWeight: 400 }}>({services.filter(s => s.status === 'operational').length}/{services.length} operational)</span></h2>
            <Button onClick={() => setReportOpen(true)}><Plus />Report incident</Button>
          </div>
          <div>
            {services.map(s => (
              <div key={s.id} className="admin-svc-card">
                <div className="admin-svc-info">
                  {serviceStatusIcon(s.status)}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{s.category} · {s.uptime} uptime · {s.latency}ms avg</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <PillBadge status={s.status} />
                  <select
                    aria-label={`Change status for ${s.name}`}
                    value={s.status}
                    onChange={e => { updateServiceStatus(s.id, e.target.value as any); toast.success(`${s.name} → ${e.target.value}`); }}
                    style={{ fontSize: 10, borderRadius: 5, border: '1px solid var(--border)', padding: '4px 6px', background: 'var(--muted)', color: 'var(--foreground)' }}
                  >
                    <option value="operational">Operational</option>
                    <option value="degraded">Degraded</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="outage">Outage</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
          {incidents.length > 0 && (
            <>
              <div className="admin-section-heading" style={{ marginTop: 24 }}>
                <h2>Incident history</h2>
              </div>
              <div className="admin-table-container">
                <table className="admin-data-table">
                  <thead><tr><th>ID</th><th>Title</th><th>Impact</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                  <tbody>
                    {incidents.map(inc => (
                      <tr key={inc.id}>
                        <td><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{inc.id}</span></td>
                        <td style={{ fontSize: 12 }}>{inc.title}</td>
                        <td><PillBadge status={inc.impact === 'Major' ? 'outage' : inc.impact === 'Minor' ? 'degraded' : 'Available'} /></td>
                        <td><PillBadge status={inc.status === 'Resolved' ? 'Resolved' : 'Processing'} /></td>
                        <td style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{inc.date}</td>
                        <td>
                          {inc.status !== 'Resolved' && (
                            <Button variant="outline" style={{ fontSize: 10, height: 28 }} onClick={() => { resolveIncident(inc.id, 'Resolved by admin.'); toast.success('Incident resolved'); }}><Check />Resolve</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Report Incident Dialog */}
          <Dialog open={reportOpen} onOpenChange={open => { if (!open) { setReportOpen(false); setIncidentTitle(''); setIncidentNote(''); } }}>
            <DialogContent>
              <DialogTitle>Report New Incident</DialogTitle>
              <DialogDescription>This creates a sample incident record in your admin workspace.</DialogDescription>
              <form className="account-form" onSubmit={e => {
                e.preventDefault();
                if (!incidentTitle.trim()) return;
                addIncident(incidentTitle.trim(), incidentImpact, incidentNote.trim() || 'Investigating issue.');
                setReportOpen(false); setIncidentTitle(''); setIncidentNote('');
                toast.success('Incident reported (sample workspace)');
              }}>
                <label className="form-field">Incident title<input value={incidentTitle} onChange={e => setIncidentTitle(e.target.value)} maxLength={100} placeholder="E.g. Elevated delivery latency on Free Fire" /></label>
                <label className="form-field">Impact level
                  <select value={incidentImpact} onChange={e => setIncidentImpact(e.target.value as any)} style={{ marginTop: 6, width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--muted)', color: 'var(--foreground)', fontSize: 13 }}>
                    <option value="Minor">Minor</option>
                    <option value="Major">Major</option>
                  </select>
                </label>
                <label className="form-field">Initial update<textarea value={incidentNote} onChange={e => setIncidentNote(e.target.value)} rows={3} placeholder="Describe what is being investigated…" /></label>
                <Button type="submit"><AlertTriangle />Report incident</Button>
              </form>
            </DialogContent>
          </Dialog>
        </section>
      )}

      {/* ── Policy Metadata ── */}
      {tab === 'policies' && (
        <section className="admin-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <p className="form-hint" style={{ marginBottom: 18 }}>Policy versioning and dates for reference only. Actual policy content is in the route files.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { label: 'Privacy Policy Version',    value: 'v2.4' },
              { label: 'Privacy Last Updated',       value: 'October 2026' },
              { label: 'Privacy Effective Date',     value: 'October 15, 2026' },
              { label: 'Refund Policy Version',      value: 'v1.9' },
              { label: 'Refund Last Updated',        value: 'October 2026' },
              { label: 'Refund Guarantee Window',    value: '24 Hours Full Money-Back' },
            ].map(item => (
              <div key={item.label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 4, textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/privacy-policy"><FileText size={14} />View Privacy Policy</Link></Button>
            <Button asChild variant="outline" style={{ fontSize: 11 }}><Link to="/refund-policy"><FileText size={14} />View Refund Policy</Link></Button>
          </div>
        </section>
      )}

      {/* ── Appearance & Reset ── */}
      {tab === 'workspace' && (
        <>
          <section className="admin-section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
            <h2>Appearance</h2>
            <p className="form-hint">Shared with the storefront. System follows your device preference.</p>
            <div className="theme-segment" role="group" aria-label="Admin theme">
              {(['light', 'dark', 'system'] as const).map(value => (
                <Button key={value} variant={theme === value ? 'default' : 'ghost'} aria-pressed={theme === value} onClick={() => setTheme(value)}>{value.charAt(0).toUpperCase() + value.slice(1)}</Button>
              ))}
            </div>
          </section>
          <section className="admin-section">
            <h2>Sample catalog export</h2>
            <p className="form-hint">Download game and FAQ drafts only. Local profiles and Player IDs are excluded.</p>
            <Button variant="outline" onClick={() => {
              const blob = new Blob([JSON.stringify({ label: 'Sample', games: catalog.map(({ image, ...g }) => g), faqs: answers }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'hasa-sample-catalog.json'; a.click(); URL.revokeObjectURL(url);
              toast.success('Sample draft exported');
            }}><Download />Export sample drafts</Button>
          </section>
          <section className="admin-section">
            <h2>Reset workspace</h2>
            <p className="form-hint">Restore all game, package, FAQ, account, order, and service drafts. Your theme is kept.</p>
            <Button variant="outline" onClick={() => setConfirm(true)}><RotateCcw />Reset sample drafts</Button>
          </section>
          <Dialog open={confirm} onOpenChange={setConfirm}>
            <DialogContent>
              <DialogTitle>Reset sample drafts?</DialogTitle>
              <DialogDescription>Discard all workspace edits made during this visit and restore to default sample data.</DialogDescription>
              <Button variant="destructive" onClick={() => { reset(); setConfirm(false); toast.success('Sample workspace reset'); }}>Reset drafts</Button>
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
