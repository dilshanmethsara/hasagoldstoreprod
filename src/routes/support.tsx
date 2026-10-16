import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Search, MessageCircle, X, Shield, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageIntro, FAQ } from '@/components/store-ui';
import { pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/support')({
  head: () =>
    pageHead(
      'Support & FAQ',
      'Find answers about games, sample packages, favorites, and the HASA GOLD STORE preview.'
    ),
  component: SupportPage,
});

function SupportPage() {
  const [query, setQuery] = useState('');
  return (
    <div className="container page-content">
      <PageIntro
        eyebrow="WE’RE HERE TO HELP"
        title="Good questions. Clear answers."
        description="Everything you need to know about exploring the store preview."
      />
      <div className="support-layout">
        <aside className="support-aside">
          <MessageCircle size={30} />
          <h2>Need a little guidance?</h2>
          <p>Start with our frequently asked questions.</p>
          <div className="notice">
            <strong>Support contact</strong>
            <br />
            Official contact details have not been provided yet. No contact channel is currently available.
          </div>
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--muted-foreground)', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Legal & Store Policies
            </span>
            <Button variant="outline" asChild size="sm" style={{ justifyContent: 'flex-start' }}>
              <Link to="/privacy-policy">
                <Shield size={14} style={{ marginRight: '8px', color: 'var(--primary)' }} /> Privacy Policy
              </Link>
            </Button>
            <Button variant="outline" asChild size="sm" style={{ justifyContent: 'flex-start' }}>
              <Link to="/refund-policy">
                <RotateCcw size={14} style={{ marginRight: '8px', color: 'var(--primary)' }} /> Refund Policy
              </Link>
            </Button>
          </div>
        </aside>
        <div>
          <div className="search-field support-search">
            <Search size={18} />
            <input
              aria-label="Search frequently asked questions"
              placeholder="Search the FAQs…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Clear FAQ search"
                onClick={() => setQuery('')}
              >
                <X />
              </Button>
            )}
          </div>
          <FAQ query={query} />
        </div>
      </div>
    </div>
  );
}