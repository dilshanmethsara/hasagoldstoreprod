import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ShieldCheck,
  Check,
  Copy,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Wallet,
  Tag,
  ArrowUpRight,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { games, pageHead } from '@/lib/store-data';
import { useDemoAccount } from '@/components/demo-account';
import { useAdmin } from '@/components/admin-context';
import { useWallet } from '@/components/wallet-context';

export const Route = createFileRoute('/checkout')({
  validateSearch: (search: Record<string, unknown>) => ({
    game: (search['game'] as string) || 'free-fire',
    pack: Number(search['pack']) || 500,
    uid: (search['uid'] as string) || '',
    server: (search['server'] as string) || '',
    ign: (search['ign'] as string) || '',
    method: (search['method'] as string) || 'wallet',
  }),
  head: () =>
    pageHead(
      'Checkout',
      'Review your sample top-up and confirm the HASA GOLD STORE checkout preview.'
    ),
  component: CheckoutPage,
});

const PAYMENT_METHODS = [
  { id: 'wallet', name: 'HASA Gold Wallet', sub: 'Pay from your store balance', short: 'Wallet', isWallet: true },
  { id: 'ezcash', name: 'eZ Cash', sub: 'Mobile wallet checkout', short: 'eZ', isEzCash: true },
  { id: 'easypaisa', name: 'Easypaisa', sub: 'Mobile wallet checkout', short: 'EP' },
  { id: 'jazzcash', name: 'JazzCash', sub: 'Mobile wallet checkout', short: 'JC' },
  { id: 'bkash', name: 'bKash', sub: 'Mobile wallet checkout', short: 'bK' },
  { id: 'nagad', name: 'Nagad', sub: 'Mobile wallet checkout', short: 'Ng' },
  { id: 'card', name: 'Visa / Mastercard', sub: 'Card payment preview', short: 'Card' },
  { id: 'binance', name: 'Binance Pay', sub: 'Crypto payment preview', short: 'Pay' },
];

function getPackageInfo(gamePacks: readonly number[], packAmount: number) {
  const idx = gamePacks.indexOf(packAmount);
  const basePkr = [240, 690, 1150, 2350, 4690, 11800][idx] || Math.round(packAmount * 2.3);
  const bonuses = [10, 35, 60, 160, 380, 1100][idx] || Math.round(packAmount * 0.1);
  return {
    priceNum: basePkr,
    pricePkr: `Rs. ${basePkr.toLocaleString()}`,
    bonus: bonuses,
  };
}

function CheckoutPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useDemoAccount();
  const { addOrder } = useAdmin();
  const { balance, formatAmount, pay, canAfford } = useWallet();

  const selectedGame = games.find(g => g.id === searchParams.game) || games[0]!;
  const selectedPack = (selectedGame.packs as readonly number[]).includes(searchParams.pack)
    ? searchParams.pack
    : selectedGame.packs[2] || selectedGame.packs[0];
  const playerId = searchParams.uid;
  const server = searchParams.server || 'Asia';
  const ign = searchParams.ign || 'Player';
  const paymentMethod = searchParams.method || 'wallet';
  const selectedPayment = PAYMENT_METHODS.find(m => m.id === paymentMethod) || PAYMENT_METHODS[0]!;

  const [ezCashPhone, setEzCashPhone] = useState('077 849 2011');
  const [ezCashPin, setEzCashPin] = useState('••••');
  const [showPin, setShowPin] = useState(false);
  const [contactInfo, setContactInfo] = useState(user?.email || '');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [promoMessage, setPromoMessage] = useState('');
  const [processingOrder, setProcessingOrder] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    item: string;
    amount: string;
    ign: string;
    playerId: string;
    server: string;
    payment: string;
    gameName?: string;
    gameImage?: string;
    packAmount?: string;
    currency?: string;
    bonus?: number;
  } | null>(null);

  const pkgData = getPackageInfo(selectedGame.packs, selectedPack);
  const discountAmount = appliedDiscount > 0 ? Math.round(pkgData.priceNum * appliedDiscount) : 0;
  const finalPayableNum = Math.max(0, pkgData.priceNum - discountAmount);
  const finalPayableFormatted = `Rs. ${finalPayableNum.toLocaleString()}`;
  const missingDetails = !playerId;

  function handleApplyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;

    if (code === 'HASA2026' || code === 'VIP10' || code === 'EZCASH10') {
      setAppliedDiscount(0.1);
      setPromoMessage('10% sample discount applied.');
      toast.success('Promo applied', {
        description: '10% sample discount has been added to this total.',
      });
    } else {
      setAppliedDiscount(0);
      setPromoMessage('That code is not valid. Try HASA2026.');
      toast.error('Invalid promo code', {
        description: 'Try HASA2026, VIP10, or EZCASH10 for this preview.',
      });
    }
  }

  function handleCompleteCheckout() {
    if (missingDetails) {
      toast.error('Details incomplete', {
        description: 'Go back to the game page and enter a Player ID first.',
      });
      return;
    }

    if (paymentMethod === 'wallet' && !canAfford(finalPayableNum)) {
      toast.error('Low wallet balance', {
        description: `You have ${formatAmount(balance)}. This sample total is ${finalPayableFormatted}.`,
      });
      return;
    }

    setProcessingOrder(true);

    setTimeout(() => {
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderRecord = {
        orderId,
        item: `${selectedGame.name} · ${selectedPack.toLocaleString()} ${selectedGame.currency} (+${pkgData.bonus} bonus)`,
        amount: finalPayableFormatted,
        ign,
        playerId: `${playerId} (${server})`,
        server,
        payment: selectedPayment.name,
        gameName: selectedGame.name,
        gameImage: selectedGame.image,
        packAmount: selectedPack.toLocaleString(),
        currency: selectedGame.currency,
        bonus: pkgData.bonus,
      };

      if (paymentMethod === 'wallet') {
        pay(
          finalPayableNum,
          `${selectedGame.name} · ${selectedPack.toLocaleString()} ${selectedGame.currency} Top-Up`,
          orderId
        );
      }

      setCompletedOrder(orderRecord);
      setProcessingOrder(false);

      addOrder({
        id: orderId,
        type: 'topup',
        customerName: ign,
        customerContact: contactInfo || 'Web Checkout Customer',
        item: `${selectedGame.name} · ${selectedPack.toLocaleString()} ${selectedGame.currency}`,
        amount: finalPayableFormatted,
        paymentMethod: selectedPayment.name,
        status: 'Completed',
        playerId: `${playerId} · ${ign}`,
        date: 'Just now',
      });

      toast.success('Order recorded', {
        description: 'This is a sample checkout. No real payment was taken.',
      });
    }, 900);
  }

  function handleCopyOrderId() {
    if (!completedOrder) return;
    navigator.clipboard?.writeText(completedOrder.orderId);
    setCopiedId(true);
    toast.success('Order ID copied', { description: completedOrder.orderId });
    setTimeout(() => setCopiedId(false), 2000);
  }

  function handleCopyReceiptSummary() {
    if (!completedOrder) return;
    const receiptText =
      `HASA GOLD STORE — SAMPLE RECEIPT\n` +
      `Order : ${completedOrder.orderId}\n` +
      `Game  : ${completedOrder.gameName || selectedGame.name}\n` +
      `IGN   : ${completedOrder.ign}\n` +
      `UID   : ${completedOrder.playerId}\n` +
      `Item  : ${completedOrder.item}\n` +
      `Pay   : ${completedOrder.payment}\n` +
      `Total : ${completedOrder.amount}\n`;
    navigator.clipboard?.writeText(receiptText);
    toast.success('Receipt copied', {
      description: 'You can paste the sample receipt anywhere you need it.',
    });
  }

  return (
    <div className="container page-content checkout-page-wrapper">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <Link to="/games">Games</Link>
        <ChevronRight size={12} />
        <Link to="/games/$game" params={{ game: selectedGame.id }}>
          {selectedGame.name}
        </Link>
        <ChevronRight size={12} />
        <span>Checkout</span>
      </nav>

      <div className="page-intro checkout-intro">
        <span className="eyebrow">Sample checkout</span>
        <h1>Review your order</h1>
        <p>
          These details were selected on the game page and cannot be changed here. Use Edit to go back if you need to update them.
        </p>
      </div>

      <div className="checkout-grid">
        <div className="checkout-main-col">
          <section className="checkout-card" aria-labelledby="checkout-summary-title">
            <div className="checkout-card-header">
              <div className="checkout-card-title">
                <span className="checkout-step-badge">
                  <Check size={14} strokeWidth={3} />
                </span>
                <div>
                  <h2 id="checkout-summary-title">Selected details</h2>
                  <p>Locked from your {selectedGame.name} top-up selection.</p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="checkout-edit-btn">
                <Link to="/games/$game" params={{ game: selectedGame.id }}>
                  <Pencil size={13} /> Edit selection
                </Link>
              </Button>
            </div>

            <div className="checkout-locked-game">
              <img src={selectedGame.image} alt="" />
              <div>
                <span className="eyebrow">Game</span>
                <strong>{selectedGame.name}</strong>
                <p>
                  {selectedPack.toLocaleString()} {selectedGame.currency} · +{pkgData.bonus} bonus
                </p>
              </div>
            </div>

            <dl className="checkout-locked-list">
              <div>
                <dt>Player ID</dt>
                <dd>{playerId || 'Not provided'}</dd>
              </div>
              <div>
                <dt>Nickname</dt>
                <dd>{ign}</dd>
              </div>
              <div>
                <dt>Server</dt>
                <dd>{server}</dd>
              </div>
              <div>
                <dt>Package</dt>
                <dd>
                  {selectedPack.toLocaleString()} {selectedGame.currency}
                </dd>
              </div>
              <div>
                <dt>Bonus</dt>
                <dd>
                  +{pkgData.bonus} {selectedGame.currency}
                </dd>
              </div>
              <div>
                <dt>Payment</dt>
                <dd>{selectedPayment.name}</dd>
              </div>
            </dl>
          </section>

          {selectedPayment.isWallet && (
            <section className="checkout-card">
              <div className="checkout-card-header">
                <div className="checkout-card-title">
                  <span className="checkout-step-badge">
                    <Wallet size={14} />
                  </span>
                  <div>
                    <h2>Wallet payment</h2>
                    <p>This order will use your HASA Gold Wallet balance.</p>
                  </div>
                </div>
              </div>
              <div className="checkout-wallet-note">
                <Wallet size={18} />
                <div>
                  <strong>Available balance: {formatAmount(balance)}</strong>
                  <p>{canAfford(finalPayableNum) ? 'Ready to confirm this sample order.' : 'Balance is lower than the sample total.'}</p>
                </div>
                {!canAfford(finalPayableNum) && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/dashboard/wallet">
                      Add funds <ArrowUpRight size={14} />
                    </Link>
                  </Button>
                )}
              </div>
            </section>
          )}

          {selectedPayment.isEzCash && (
            <section className="checkout-card">
              <div className="checkout-card-header">
                <div className="checkout-card-title">
                  <span className="checkout-step-badge">eZ</span>
                  <div>
                    <h2>eZ Cash details</h2>
                    <p>Enter the mobile number and PIN for this payment preview.</p>
                  </div>
                </div>
              </div>
              <div className="checkout-ezcash-fields">
                <label>
                  Mobile number
                  <input
                    type="text"
                    value={ezCashPhone}
                    onChange={e => setEzCashPhone(e.target.value)}
                    placeholder="077 123 4567"
                  />
                </label>
                <label>
                  PIN
                  <div className="checkout-pin-wrap">
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={4}
                      value={ezCashPin}
                      onChange={e => setEzCashPin(e.target.value)}
                      placeholder="••••"
                    />
                    <button type="button" onClick={() => setShowPin(!showPin)} aria-label="Toggle PIN visibility">
                      {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
              </div>
            </section>
          )}

          <section className="checkout-card">
            <div className="checkout-card-header">
              <div className="checkout-card-title">
                <span className="checkout-step-badge">@</span>
                <div>
                  <h2>Receipt contact</h2>
                  <p>Optional email or WhatsApp number for this sample receipt.</p>
                </div>
              </div>
            </div>
            <input
              className="checkout-contact-input"
              type="text"
              value={contactInfo}
              onChange={e => setContactInfo(e.target.value)}
              placeholder="Email or WhatsApp number"
            />
          </section>
        </div>

        <aside className="checkout-sidebar-col">
          <div className="checkout-summary-card">
            <div className="checkout-summary-head">
              <h3>Order total</h3>
              <p>Confirm this sample checkout</p>
            </div>

            <div className="checkout-summary-game">
              <img src={selectedGame.image} alt="" />
              <div>
                <strong>{selectedGame.name}</strong>
                <span>
                  {selectedPack.toLocaleString()} {selectedGame.currency}
                </span>
              </div>
            </div>

            <div className="checkout-promo">
              <label htmlFor="promo-code">Promo code</label>
              <div className="checkout-promo-row">
                <input
                  id="promo-code"
                  type="text"
                  placeholder="HASA2026"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline" onClick={handleApplyPromo}>
                  <Tag size={13} /> Apply
                </Button>
              </div>
              {promoMessage && (
                <p className={appliedDiscount > 0 ? 'promo-ok' : 'promo-err'}>{promoMessage}</p>
              )}
            </div>

            <div className="checkout-breakdown">
              <div>
                <span>Subtotal</span>
                <span>{pkgData.pricePkr}</span>
              </div>
              <div>
                <span>Payment</span>
                <span>{selectedPayment.name}</span>
              </div>
              <div>
                <span>Fees</span>
                <span>Rs. 0</span>
              </div>
              {appliedDiscount > 0 && (
                <div className="is-discount">
                  <span>Discount</span>
                  <span>-Rs. {discountAmount.toLocaleString()}</span>
                </div>
              )}
            </div>

            <div className="checkout-total">
              <div>
                <span>Total</span>
                <small>Sample pricing for preview</small>
              </div>
              <strong>{finalPayableFormatted}</strong>
            </div>

            <Button
              className="checkout-summary-cta"
              onClick={handleCompleteCheckout}
              disabled={processingOrder || missingDetails}
            >
              {processingOrder ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Processing
                </>
              ) : (
                <>
                  Confirm sample order
                  <ArrowRight size={16} />
                </>
              )}
            </Button>

            {missingDetails && (
              <p className="checkout-missing">Go back to the game page and enter a Player ID first.</p>
            )}

            <div className="checkout-assurance">
              <span>
                <ShieldCheck size={13} /> Secure preview checkout
              </span>
              <span>
                <CheckCircle2 size={13} /> No real payment charged
              </span>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={Boolean(completedOrder)} onOpenChange={open => { if (!open) setCompletedOrder(null); }}>
        <DialogContent className="checkout-receipt-dialog">
          {completedOrder && (
            <div className="receipt-sheet">
              <div className="receipt-sheet-top">
                <div className="receipt-check" aria-hidden="true">
                  <Check size={28} strokeWidth={2.6} />
                </div>
                <span className="eyebrow">Sample receipt</span>
                <DialogTitle className="receipt-title">Order confirmed</DialogTitle>
                <DialogDescription className="receipt-lead">
                  Preview complete. No real payment was processed.
                </DialogDescription>
              </div>

              <div className="receipt-ticket">
                <div className="receipt-ticket-credit">
                  {completedOrder.gameImage && (
                    <img src={completedOrder.gameImage} alt="" />
                  )}
                  <div>
                    <span className="receipt-game-name">{completedOrder.gameName}</span>
                    <strong>
                      {completedOrder.packAmount} {completedOrder.currency}
                    </strong>
                    {completedOrder.bonus ? (
                      <em>+{completedOrder.bonus} bonus included</em>
                    ) : null}
                  </div>
                  <span className="receipt-status">Recorded</span>
                </div>

                <div className="receipt-perforation" aria-hidden="true">
                  <span />
                  <span />
                </div>

                <dl className="receipt-meta">
                  <div>
                    <dt>Player</dt>
                    <dd>{completedOrder.ign}</dd>
                  </div>
                  <div>
                    <dt>Player ID</dt>
                    <dd>{completedOrder.playerId}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>{completedOrder.payment}</dd>
                  </div>
                  <div>
                    <dt>Order ID</dt>
                    <dd>
                      {completedOrder.orderId}
                      <button type="button" onClick={handleCopyOrderId} aria-label="Copy order ID">
                        {copiedId ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </dd>
                  </div>
                </dl>

                <div className="receipt-total-bar">
                  <span>Total</span>
                  <strong>{completedOrder.amount}</strong>
                </div>
              </div>

              <div className="receipt-actions">
                <Button
                  className="receipt-done"
                  onClick={() => {
                    setCompletedOrder(null);
                    navigate({ to: '/dashboard/wallet' });
                  }}
                >
                  Done
                  <ArrowRight size={16} />
                </Button>
                <div className="receipt-secondary">
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dashboard/orders">My orders</Link>
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleCopyReceiptSummary}>
                    <Copy size={13} /> Copy
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/admin/orders">
                      Admin <ExternalLink size={12} />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
