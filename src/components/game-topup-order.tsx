import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  ShieldCheck,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Game } from '@/lib/store-data';
import { useDemoAccount } from './demo-account';
import { useWallet } from './wallet-context';

interface GameTopUpOrderProps {
  game: Game;
}

const DEMO_VERIFIED_PROFILES: Record<
  string,
  { id: string; ign: string; level: number; guild: string; rank: string; server: string }
> = {
  'free-fire': {
    id: '894120381',
    ign: 'HASA Sultan',
    level: 72,
    guild: 'HASA-ESPORTS',
    rank: 'Grandmaster S34',
    server: 'Asia (PK / BD / IN)',
  },
  'pubg-mobile': {
    id: '5129840192',
    ign: 'HASA M416',
    level: 69,
    guild: 'HASA-CLAN',
    rank: 'Ace Master',
    server: 'Global / Asia',
  },
  'blood-strike': {
    id: 'BS-9912401',
    ign: 'HASA Strike',
    level: 55,
    guild: 'TITAN-PK',
    rank: 'Legendary II',
    server: 'Southeast Asia',
  },
  'call-of-duty-mobile': {
    id: '67491029312',
    ign: 'HASA Ghost',
    level: 150,
    guild: 'TASKFORCE-141',
    rank: 'Legendary',
    server: 'Activision (Global)',
  },
};

const GAME_SERVERS: Record<string, string[]> = {
  'free-fire': ['Asia (PK / BD / IN)', 'Singapore / Malaysia', 'Europe', 'North America', 'Middle East'],
  'pubg-mobile': ['Global / Asia', 'Europe', 'North America', 'South America', 'KRJP'],
  'blood-strike': ['Southeast Asia', 'Latin America', 'North America', 'Middle East'],
  'call-of-duty-mobile': ['Activision (Global)', 'Garena (Southeast Asia)'],
};

const PAYMENT_METHODS = [
  { id: 'wallet', name: 'HASA Gold Wallet', sub: 'Pay from your store balance', short: 'Wallet', isWallet: true },
  { id: 'ezcash', name: 'eZ Cash', sub: 'Mobile wallet checkout', short: 'eZ' },
  { id: 'easypaisa', name: 'Easypaisa', sub: 'Mobile wallet checkout', short: 'EP' },
  { id: 'jazzcash', name: 'JazzCash', sub: 'Mobile wallet checkout', short: 'JC' },
  { id: 'bkash', name: 'bKash', sub: 'Mobile wallet checkout', short: 'bK' },
  { id: 'nagad', name: 'Nagad', sub: 'Mobile wallet checkout', short: 'Ng' },
  { id: 'card', name: 'Visa / Mastercard', sub: 'Card payment preview', short: 'Card' },
  { id: 'binance', name: 'Binance Pay', sub: 'Crypto payment preview', short: 'Pay' },
];

export function GameTopUpOrder({ game }: GameTopUpOrderProps) {
  const navigate = useNavigate();
  const { user } = useDemoAccount();
  const { balance, formatAmount, canAfford } = useWallet();

  const servers = GAME_SERVERS[game.id] || ['Asia', 'Global', 'Europe'];
  const [server, setServer] = useState<string>(servers[0] || 'Asia');

  const defaultDemo = DEMO_VERIFIED_PROFILES[game.id] || {
    id: '894120381',
    ign: 'HASA Player',
    level: 70,
    guild: 'HASA-TEAM',
    rank: 'Master',
    server: servers[0] || 'Asia',
  };

  const [playerId, setPlayerId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedAccount, setVerifiedAccount] = useState<{
    id: string;
    ign: string;
    level: number;
    guild: string;
    rank: string;
    server: string;
  } | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedPack, setSelectedPack] = useState<number>(game.packs[2] || game.packs[0]);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [customerContact, setCustomerContact] = useState(user?.email || '');

  useEffect(() => {
    setPlayerId('');
    setVerifiedAccount(null);
    setSelectedPack(game.packs[2] || game.packs[0]);
    setServer(servers[0] || 'Asia');
  }, [game.id]);

  function resolveProfile(trimmed: string) {
    let ign = defaultDemo.ign;
    let level = defaultDemo.level;
    let rank = defaultDemo.rank;
    let guild = defaultDemo.guild;

    if (trimmed !== defaultDemo.id) {
      const cleanDigits = trimmed.replace(/\D/g, '');
      const suffix = cleanDigits.slice(-4) || '99';
      const prefixes = ['HASA', 'Shadow', 'Venom', 'King', 'Ghost'];
      const chosenPrefix = prefixes[trimmed.length % prefixes.length];
      ign = `${chosenPrefix}_${suffix}`;
      level = 45 + ((trimmed.length * 3) % 40);
      rank = 'Active Player';
    }

    return {
      id: trimmed,
      ign,
      level,
      guild,
      rank,
      server: server || servers[0] || 'Asia',
    };
  }

  function handleVerify() {
    const trimmed = playerId.trim();
    if (!trimmed) {
      toast.error('Player ID required', {
        description: 'Enter your UID first so we can look up the account.',
      });
      return;
    }
    if (trimmed.length < 5) {
      toast.error('Player ID too short', {
        description: 'Use at least 5 characters, then try verify again.',
      });
      return;
    }

    setVerifying(true);
    setTimeout(() => {
      const profile = resolveProfile(trimmed);
      setVerifying(false);
      setVerifiedAccount(profile);
      toast.success('Player ID verified', {
        description: `${profile.ign} is ready for this sample top-up.`,
      });
    }, 650);
  }

  function fillDemoId(idToFill: string) {
    setPlayerId(idToFill);
    setVerifiedAccount(null);
  }

  function getPackageData(amount: number) {
    const idx = (game.packs as readonly number[]).indexOf(amount);
    const basePkr = [240, 690, 1150, 2350, 4690, 11800][idx] || Math.round(amount * 2.3);
    const baseUsd = [1.99, 4.99, 8.99, 17.99, 34.99, 89.99][idx] || Number((amount * 0.018).toFixed(2));
    const bonuses = [10, 35, 60, 160, 380, 1100][idx] || Math.round(amount * 0.1);

    return {
      pricePkr: `Rs. ${basePkr.toLocaleString()}`,
      priceNum: basePkr,
      priceUsd: `$${baseUsd}`,
      bonus: bonuses,
      isPopular: idx === 2,
      isBestValue: idx === 4,
      isVip: idx === 5,
    };
  }

  const currentPkg = getPackageData(selectedPack);
  const selectedPayment = PAYMENT_METHODS.find(p => p.id === paymentMethod) || PAYMENT_METHODS[0]!;

  function handlePlaceOrder() {
    let accountToUse = verifiedAccount;

    if (!accountToUse) {
      const trimmed = playerId.trim();
      if (!trimmed || trimmed.length < 5) {
        toast.error('Player ID required', {
          description: 'Enter a valid UID so the package can be credited to the right account.',
        });
        const inputEl = document.getElementById('player-id-input');
        inputEl?.focus();
        inputEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      accountToUse = resolveProfile(trimmed);
      setVerifiedAccount(accountToUse);
    }

    navigate({
      to: '/checkout',
      search: {
        game: game.id,
        pack: selectedPack,
        uid: accountToUse.id,
        server: accountToUse.server,
        ign: accountToUse.ign,
        method: paymentMethod,
      },
    });
  }

  return (
    <div className="topup-order-container">
      <div className="topup-info-strip">
        <div className="topup-info-item">
          <ShieldCheck size={16} />
          <span>Secure Player ID check</span>
        </div>
        <div className="topup-info-item">
          <CheckCircle2 size={16} />
          <span>Sample packages for preview</span>
        </div>
        <div className="topup-info-item">
          <Wallet size={16} />
          <span>Checkout flow for demo orders</span>
        </div>
      </div>

      <div className="topup-grid-layout">
        <div className="topup-steps-flow">
          <section className="topup-step-box" aria-labelledby="step1-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">1</span>
                <div>
                  <h2 id="step1-title">Player ID</h2>
                  <p>Enter your {game.name} UID so the top-up can be credited correctly.</p>
                </div>
              </div>
              <button type="button" className="id-guide-btn" onClick={() => setHelpOpen(true)}>
                <HelpCircle size={14} /> Where is my ID?
              </button>
            </div>

            <div className="player-id-form">
              <div className="player-id-fields">
                <div className={`id-input-group ${verifiedAccount ? 'verified-input' : ''}`}>
                  <span className="id-icon-prefix">
                    {verifiedAccount ? <CheckCircle2 size={18} /> : <UserCheck size={18} />}
                  </span>
                  <input
                    id="player-id-input"
                    type="text"
                    placeholder={`${game.name} UID / Character ID`}
                    value={playerId}
                    onChange={e => {
                      setPlayerId(e.target.value);
                      if (verifiedAccount) setVerifiedAccount(null);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleVerify();
                      }
                    }}
                  />
                  <div className="id-verify-action">
                    <Button size="sm" onClick={handleVerify} disabled={verifying || !playerId.trim()}>
                      {verifying ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" /> Checking
                        </>
                      ) : verifiedAccount ? (
                        <>
                          <Check size={14} /> Re-check
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} /> Verify
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="server-select-box">
                  <select
                    value={server}
                    onChange={e => {
                      setServer(e.target.value);
                      if (verifiedAccount) setVerifiedAccount(null);
                    }}
                    aria-label="Select game server"
                  >
                    {servers.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="id-support-row">
                <div className="id-demo-chips">
                  <span className="id-chip-label">Try a sample ID</span>
                  <button type="button" className="id-chip-btn" onClick={() => fillDemoId(defaultDemo.id)}>
                    {defaultDemo.id}
                  </button>
                  {user?.players?.[game.id] && (
                    <button
                      type="button"
                      className="id-chip-btn"
                      onClick={() => {
                        const saved = user.players?.[game.id];
                        if (saved) fillDemoId(saved);
                      }}
                    >
                      Saved · {user.players[game.id]}
                    </button>
                  )}
                </div>
              </div>

              {verifiedAccount && (
                <div className="verified-account-banner" role="status">
                  <div className="verified-profile-left">
                    <div className="verified-avatar-wrapper">
                      <span>{verifiedAccount.ign.charAt(0)}</span>
                      <span className="verified-badge-mini">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    </div>
                    <div className="verified-meta">
                      <div className="verified-ign-row">
                        <span className="verified-ign">{verifiedAccount.ign}</span>
                        <span className="verified-pill">
                          <ShieldCheck size={11} /> Verified
                        </span>
                      </div>
                      <div className="verified-stats-row">
                        <span>
                          <strong>UID</strong> {verifiedAccount.id}
                        </span>
                        <span className="verified-dot" />
                        <span>
                          <strong>Region</strong> {verifiedAccount.server}
                        </span>
                        <span className="verified-dot" />
                        <span>
                          <strong>Level</strong> {verifiedAccount.level}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="verified-reverify-btn"
                    onClick={() => {
                      setVerifiedAccount(null);
                      document.getElementById('player-id-input')?.focus();
                    }}
                  >
                    Change ID
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step2-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">2</span>
                <div>
                  <h2 id="step2-title">{game.currency} package</h2>
                  <p>Choose a sample package amount for this preview order.</p>
                </div>
              </div>
            </div>

            <div className="topup-package-grid">
              {game.packs.map(amount => {
                const pkg = getPackageData(amount);
                const isSelected = selectedPack === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    className={`topup-package-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedPack(amount)}
                    aria-pressed={isSelected}
                  >
                    {pkg.isPopular && <span className="package-badge-tag">Popular</span>}
                    {pkg.isBestValue && <span className="package-badge-tag">Best value</span>}
                    {pkg.isVip && <span className="package-badge-tag">Mega pack</span>}

                    <div className="package-amount-title">
                      {amount.toLocaleString()} {game.currency}
                    </div>
                    <div className="package-bonus-chip">+{pkg.bonus} bonus {game.currency}</div>
                    <div className="package-price-row">
                      <span className="package-price-main">{pkg.pricePkr}</span>
                      <span className="package-price-usd">{pkg.priceUsd}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step3-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">3</span>
                <div>
                  <h2 id="step3-title">Payment method</h2>
                  <p>Select how you would like to continue at checkout.</p>
                </div>
              </div>
            </div>

            <div className="payment-selector-grid">
              {PAYMENT_METHODS.map(method => {
                const isSelected = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    className={`payment-method-card ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setPaymentMethod(method.id)}
                    aria-pressed={isSelected}
                  >
                    <div className="payment-card-left">
                      <div className="payment-brand-badge">{method.short}</div>
                      <div>
                        <div className="payment-name">{method.name}</div>
                        <div className="payment-sub">{method.sub}</div>
                        {method.id === 'wallet' && (
                          <div className="payment-wallet-meta">
                            <span>Balance {formatAmount(balance)}</span>
                            <span className={canAfford(currentPkg.priceNum) ? 'is-ok' : 'is-low'}>
                              {canAfford(currentPkg.priceNum) ? 'Ready' : 'Low balance'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="payment-check-circle">
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step4-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">4</span>
                <div>
                  <h2 id="step4-title">Receipt contact</h2>
                  <p>Optional email or WhatsApp number for order updates.</p>
                </div>
              </div>
            </div>

            <div className="topup-contact-field">
              <input
                type="text"
                placeholder="Email or WhatsApp number"
                value={customerContact}
                onChange={e => setCustomerContact(e.target.value)}
              />
              <span>Used only for this sample order receipt preview.</span>
            </div>
          </section>
        </div>

        <aside className="topup-summary-sidebar">
          <div className="order-summary-card">
            <div className="summary-header">
              <h3>Order summary</h3>
              <p>Review details before checkout</p>
            </div>

            <div className="summary-items-list">
              <div className="summary-row">
                <span className="summary-row-label">Game</span>
                <span className="summary-row-val">{game.name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Player ID</span>
                <span className="summary-row-val">
                  {verifiedAccount ? (
                    <span className="summary-verified">
                      <CheckCircle2 size={13} /> {verifiedAccount.id}
                    </span>
                  ) : (
                    <span className="summary-muted">{playerId || 'Not entered'}</span>
                  )}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Nickname</span>
                <span className="summary-row-val">
                  {verifiedAccount ? verifiedAccount.ign : <span className="summary-muted">Pending verify</span>}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Server</span>
                <span className="summary-row-val">{server}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Package</span>
                <span className="summary-row-val">
                  {selectedPack.toLocaleString()} {game.currency}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Bonus</span>
                <span className="summary-row-val">
                  +{currentPkg.bonus} {game.currency}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Payment</span>
                <span className="summary-row-val">{selectedPayment.name}</span>
              </div>
            </div>

            <div className="summary-total-divider">
              <div className="summary-total-row">
                <div>
                  <div className="summary-total-label">Total</div>
                  <div className="summary-total-note">Sample pricing for preview</div>
                </div>
                <div className="summary-total-amount">{currentPkg.pricePkr}</div>
              </div>

              <Button className="instant-order-cta-btn" onClick={handlePlaceOrder}>
                Continue to checkout
                <ArrowRight size={16} />
              </Button>

              {!verifiedAccount && (
                <div className="id-required-warning">
                  <AlertCircle size={15} />
                  <span>Verify your Player ID so the package is credited to the right account.</span>
                </div>
              )}

              <div className="summary-assurance">
                <span>
                  <ShieldCheck size={13} /> Secure preview checkout
                </span>
                <span>
                  <CheckCircle2 size={13} /> No real payment charged
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="topup-help-dialog">
          <DialogTitle>
            <HelpCircle size={18} />
            Finding your {game.name} Player ID
          </DialogTitle>
          <DialogDescription>
            Three quick steps inside the game app:
          </DialogDescription>

          <ol className="topup-help-steps">
            <li>
              <strong>Open your profile</strong>
              <p>Tap your avatar in the lobby to open the profile screen.</p>
            </li>
            <li>
              <strong>Locate the Player ID</strong>
              <p>
                Under your nickname you will see a numeric UID such as <code>{defaultDemo.id}</code>.
              </p>
            </li>
            <li>
              <strong>Copy the ID</strong>
              <p>Use the copy icon next to the ID, then paste it into the field above.</p>
            </li>
          </ol>

          <div className="topup-help-note">
            <ShieldCheck size={16} />
            <span>Never share your password or OTP. Only your public Player ID is needed.</span>
          </div>

          <Button onClick={() => setHelpOpen(false)}>
            Got it <Check size={16} />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
