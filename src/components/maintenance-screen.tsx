import { Link } from "@tanstack/react-router";
import { Wrench, ShieldAlert, Clock, MessageCircle, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import hasaLogo from "@/assets/newhasalogo.png";
import type { SettingsDoc } from "@/lib/firestore-schema";

export function MaintenanceScreen({
  settings,
  isAdmin = false,
}: {
  settings: SettingsDoc | null;
  isAdmin?: boolean;
}) {
  const title = settings?.maintenanceTitle?.trim() || "Under Scheduled Maintenance";
  const message =
    settings?.maintenanceMessage?.trim() ||
    "We are performing routine server upgrades and catalog optimization to bring you faster delivery and improved services. We will be back online shortly!";
  const whatsapp = settings?.supportWhatsapp?.trim();
  const email = settings?.supportEmail?.trim();

  return (
    <div className="maintenance-wrapper">
      <div className="maintenance-card">
        {/* Glowing badge & brand */}
        <div className="maintenance-header">
          <div className="maintenance-brand">
            <img src={hasaLogo} alt="HASA GOLD STORE" className="maintenance-logo" />
            <span className="maintenance-store-name">
              HASA <span className="text-primary">GOLD</span> STORE
            </span>
          </div>

          <div className="maintenance-badge">
            <span className="maintenance-badge-dot" />
            <Wrench size={13} />
            <span>SYSTEM UPGRADE IN PROGRESS</span>
          </div>
        </div>

        {/* Visual hero graphic */}
        <div className="maintenance-visual">
          <div className="maintenance-pulse-ring" />
          <div className="maintenance-icon-bubble">
            <ShieldAlert size={38} className="maintenance-icon" />
          </div>
        </div>

        {/* Text information */}
        <div className="maintenance-content">
          <h1 className="maintenance-title">{title}</h1>
          <p className="maintenance-desc">{message}</p>

          <div className="maintenance-highlights">
            <div className="maintenance-highlight-item">
              <Clock size={16} />
              <div>
                <strong>Safe & Secure</strong>
                <small>Existing wallet balances and completed orders are unaffected.</small>
              </div>
            </div>
            <div className="maintenance-highlight-item">
              <Wrench size={16} />
              <div>
                <strong>Temporary Pause</strong>
                <small>New orders and checkouts will resume as soon as upgrades finish.</small>
              </div>
            </div>
          </div>
        </div>

        {/* Support channels */}
        {(whatsapp || email) && (
          <div className="maintenance-support-box">
            <span className="maintenance-support-label">Need urgent assistance with an order?</span>
            <div className="maintenance-support-actions">
              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="maintenance-contact-btn is-whatsapp"
                >
                  <MessageCircle size={15} />
                  WhatsApp Support
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className="maintenance-contact-btn is-email">
                  <Mail size={15} />
                  Email Support
                </a>
              )}
            </div>
          </div>
        )}

        <div className="maintenance-footer">
          <span className="maintenance-status-ping">
            Estimated turnaround: short duration · live auto-check active
          </span>
        </div>
      </div>
    </div>
  );
}
