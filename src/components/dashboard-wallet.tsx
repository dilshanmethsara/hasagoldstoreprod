import { useState, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  History,
  Info,
  Lock,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "./account-context";
import { useWallet } from "./wallet-context";

function getTxTypeClass(type: string) {
  switch (type) {
    case "deposit":
      return "is-deposit";
    case "adjustment":
      return "is-adjustment";
    case "purchase":
      return "is-purchase";
    default:
      return "";
  }
}

export function DashboardWallet() {
  const { user } = useAccount();
  const {
    balance,
    transactions,
    formatAmount,
    isLoaded,
    error: walletError,
    historyError: walletHistoryError,
  } = useWallet();

  const otherMethods = [
    { id: "bank", name: "Bank Transfer", sub: "Coming soon", icon: <CreditCard size={20} /> },
    { id: "card", name: "Visa / Mastercard", sub: "Coming soon", icon: <CreditCard size={20} /> },
    { id: "crypto", name: "USDT / Crypto", sub: "Coming soon", icon: <Smartphone size={20} /> },
  ];

  return (
    <div className="wallet-page-wrapper">
      {/* Redesigned Premium Header & Quick Stats */}
      <div className="wallet-header-hero">
        <div className="wallet-hero-content">
          <span className="wallet-eyebrow">
            <Sparkles size={13} /> SECURE STORE BALANCE
          </span>
          <h1>HASA Gold Wallet</h1>
          <p>
            Wallet balance and transaction history are available here. Automatic eZ Cash wallet
            recharge is temporarily unavailable.
          </p>
        </div>
      </div>

      {/* Modern High-End Virtual VIP Card */}
      <div className="wallet-card-showcase">
        <div className="wallet-modern-card">
          <div className="wallet-modern-card-glow" />
          <div className="wallet-modern-card-pattern" />

          <div className="wallet-modern-card-top">
            <div className="wallet-modern-chip-box">
              <div className="wallet-modern-chip">
                <span className="chip-facet" />
                <span className="chip-facet" />
              </div>
              <span className="wallet-contactless">
                <Lock size={15} />
              </span>
            </div>

            <div className="wallet-modern-brand-tag">
              <span className="wallet-tag-dot" />
              <span>HASA GOLD STORE</span>
            </div>
          </div>

          <div className="wallet-modern-card-middle">
            <span className="wallet-modern-balance-label">AVAILABLE BALANCE</span>
            <div className="wallet-modern-balance-val">
              {walletError ? "Unavailable" : isLoaded ? formatAmount(balance) : "…"}
            </div>
          </div>

          <div className="wallet-modern-card-bottom">
            <div className="wallet-modern-user-info">
              <span className="wallet-meta-label">MEMBER</span>
              <strong className="wallet-meta-val">
                {user?.name?.toUpperCase() || "VERIFIED CUSTOMER"}
              </strong>
            </div>

            <div className="wallet-modern-curr-info">
              <span className="wallet-meta-label">CURRENCY</span>
              <strong className="wallet-meta-val">LKR (Rs.)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Security Reassurance Strip */}
      <div className="wallet-security-banner">
        <div className="wallet-sec-icon">
          <ShieldCheck size={18} />
        </div>
        <div className="wallet-sec-copy">
          <strong>Protected &amp; Audited Wallet</strong>
          <span>
            Wallet activity appears in your transaction history. Automatic eZ Cash deposits are
            currently disabled while verification is unavailable.
          </span>
        </div>
      </div>

      {walletError && (
        <div className="admin-error-banner" role="alert">
          {walletError}
        </div>
      )}
      {walletHistoryError && (
        <div className="admin-error-banner" role="alert">
          {walletHistoryError}
        </div>
      )}

      <section className="wallet-deposit-section">
        <div className="wallet-deposit-card">
          <div className="wallet-deposit-header">
            <div className="wallet-dep-title-row">
              <div className="wallet-dep-icon-wrap">
                <Info size={22} />
              </div>
              <div>
                <h2>Wallet recharge temporarily unavailable</h2>
                <p>
                  Automatic eZ Cash verification is currently unavailable. Please do not send a
                  deposit for wallet credit. Your existing balance and transaction history remain
                  available below.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Coming Soon Alternative Gateways */}
      <section className="wallet-methods-row">
        <span className="wallet-methods-title">Upcoming Deposit Methods</span>
        <div className="wallet-methods-grid">
          {otherMethods.map((m) => (
            <div key={m.id} className="wallet-method-card">
              <span className="wallet-method-icon">{m.icon}</span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.sub}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real-time Ledger */}
      <section className="wallet-ledger-section">
        <div className="wallet-ledger-head">
          <div className="wallet-ledger-title">
            <History size={18} />
            <h2>Transaction Ledger</h2>
          </div>
          <span className="wallet-ledger-count">{transactions.length} records</span>
        </div>

        {transactions.length ? (
          <div className="wallet-ledger-list">
            {transactions.map((tx, idx) => {
              const isPositive = tx.amount > 0;
              const cls = getTxTypeClass(tx.type);
              return (
                <div key={tx.id ? `${tx.id}-${idx}` : `tx-${idx}`} className="wallet-ledger-item">
                  <div className="wallet-ledger-left">
                    <div className={`wallet-ledger-icon-bubble ${cls}`}>
                      {isPositive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>

                    <div className="wallet-ledger-info">
                      <div className="wallet-ledger-top-line">
                        <strong className="wallet-ledger-tx-name">{tx.title}</strong>
                        <span className={`wallet-ledger-pill ${cls}`}>{tx.type}</span>
                      </div>

                      <div className="wallet-ledger-meta-line">
                        {tx.type === "purchase" ? (
                          <>
                            <span className="wallet-order-tag">
                              Order #{tx.referenceNumber || tx.id}
                            </span>{" "}
                            · {tx.method} · {tx.date}
                          </>
                        ) : (
                          <>
                            <code>{tx.id}</code> · {tx.method} · {tx.date}
                          </>
                        )}
                      </div>

                      {tx.reason && (
                        <div className="wallet-ledger-note">
                          <span>{tx.type === "adjustment" ? "Reason:" : "Package:"}</span>
                          <strong>{tx.reason}</strong>
                        </div>
                      )}

                      {tx.type !== "purchase" && tx.referenceNumber && (
                        <div className="wallet-ledger-note">
                          <span>RN:</span>
                          <code>{tx.referenceNumber}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="wallet-ledger-right">
                    <span
                      className={`wallet-ledger-amount ${isPositive ? "is-credit" : "is-debit"}`}
                    >
                      {isPositive ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount)}
                    </span>
                    <span className="wallet-ledger-status">● {tx.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="wallet-empty-ledger">
            <Wallet size={36} />
            <h3>No transactions recorded yet</h3>
            <p>Once you make a deposit or pay for top-ups, detailed records will appear here.</p>
          </div>
        )}
      </section>
    </div>
  );
}
