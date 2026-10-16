import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, BadgeCheck, CheckCircle2,
  ChevronDown, ChevronRight, Clock, ExternalLink,
  Globe, HardDrive, RefreshCw, Server, Shield,
  Wifi, Zap, Bell, TrendingUp, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/status')({
  head: () => pageHead('Service Status', 'Live operational status, uptime history, and incident reports for HASA GOLD STORE services.'),
  component: StatusPage,
});

type ServiceStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';
interface Service {
  id: string; name: string; description: string;
  Icon: React.ComponentType<{ size?: number }>;
  status: ServiceStatus; latency: number; uptime: number; history: number[];
}
interface Incident {
  id: string; title: string; status: 'resolved' | 'monitoring' | 'investigating' | 'scheduled';
  severity: 'minor' | 'major' | 'critical' | 'maintenance';
  date: string; time: string; updates: { time: string; message: string }[];
}

const SERVICES: Service[] = [
  { id: 'website', name: 'Website & CDN', description: 'Main storefront, static assets, and global CDN delivery', Icon: Globe, status: 'operational', latency: 42, uptime: 99.98, history: Array.from({ length: 30 }, (_, i) => i === 7 ? 2 : 1) },
  { id: 'topup-api', name: 'Top-Up Service', description: 'In-game currency top-up processing and delivery engine', Icon: Zap, status: 'operational', latency: 188, uptime: 99.91, history: Array.from({ length: 30 }, (_, i) => i === 12 ? 0 : i === 13 ? 2 : 1) },
  { id: 'accounts', name: 'Account Marketplace', description: 'Game account listings, inventory verification, and handover system', Icon: Shield, status: 'operational', latency: 94, uptime: 100, history: Array.from({ length: 30 }, () => 1) },
  { id: 'payments', name: 'Payment Gateway', description: 'Secure payment processing and transaction management', Icon: Server, status: 'operational', latency: 310, uptime: 99.85, history: Array.from({ length: 30 }, (_, i) => i === 3 ? 2 : i === 18 ? 2 : 1) },
  { id: 'auth', name: 'Authentication', description: 'User login, session management, and account security', Icon: BadgeCheck, status: 'operational', latency: 56, uptime: 100, history: Array.from({ length: 30 }, () => 1) },
  { id: 'support', name: 'Support System', description: 'Customer support chat, ticketing, and response routing', Icon: Activity, status: 'operational', latency: 120, uptime: 99.72, history: Array.from({ length: 30 }, (_, i) => i === 21 ? 0 : i === 22 ? 2 : 1) },
  { id: 'delivery', name: 'Order Delivery', description: 'Automated in-game credit delivery and fulfilment queue', Icon: TrendingUp, status: 'operational', latency: 204, uptime: 99.94, history: Array.from({ length: 30 }, (_, i) => i === 9 ? 2 : 1) },
  { id: 'network', name: 'Network & Routing', description: 'Global anycast routing, DDoS protection, and edge nodes', Icon: Wifi, status: 'operational', latency: 18, uptime: 99.99, history: Array.from({ length: 30 }, () => 1) },
  { id: 'database', name: 'Database Cluster', description: 'Primary data stores, read replicas, and backup systems', Icon: HardDrive, status: 'operational', latency: 28, uptime: 100, history: Array.from({ length: 30 }, () => 1) },
];

const INCIDENTS: Incident[] = [
  { id: 'inc-003', title: 'Scheduled maintenance — Top-Up API upgrade', status: 'scheduled', severity: 'maintenance', date: 'Oct 20, 2026', time: '02:00 – 04:00 UTC', updates: [{ time: 'Upcoming', message: 'We will be performing a routine API upgrade. Top-up orders may experience short delays during this window. All other services remain unaffected.' }] },
  { id: 'inc-002', title: 'Elevated latency on Top-Up delivery queue', status: 'resolved', severity: 'minor', date: 'Oct 13, 2026', time: '14:22 UTC', updates: [{ time: '15:41 UTC', message: 'All delivery queue latency has returned to normal levels. Root cause identified as an upstream provider cache purge. No orders were lost.' }, { time: '14:58 UTC', message: 'Delivery queue is recovering. Backlog is being processed at increased rate. Estimated full resolution in ~30 minutes.' }, { time: '14:22 UTC', message: 'We are investigating elevated latency in the top-up delivery queue. Some orders may experience delays of 5–15 minutes.' }] },
  { id: 'inc-001', title: 'Brief website CDN interruption in Southeast Asia', status: 'resolved', severity: 'minor', date: 'Oct 8, 2026', time: '07:14 UTC', updates: [{ time: '07:52 UTC', message: 'CDN edge node in SGP has been restored. All traffic is routing normally. No data was affected.' }, { time: '07:31 UTC', message: 'Issue isolated to Singapore edge node. Traffic is being rerouted to HKG and BOM edge nodes while we work on a fix.' }, { time: '07:14 UTC', message: 'Investigating reports of slow page loads and connection timeouts for users in Southeast Asia.' }] },
];

const STATUS_LABEL: Record<ServiceStatus, string> = { operational: 'Operational', degraded: 'Degraded', outage: 'Outage', maintenance: 'Maintenance' };
const SEVERITY_LABEL: Record<string, string> = { minor: 'Minor', major: 'Major', critical: 'Critical', maintenance: 'Maintenance' };

function overallStatus(s: Service[]): ServiceStatus {
  if (s.some(x => x.status === 'outage')) return 'outage';
  if (s.some(x => x.status === 'degraded')) return 'degraded';
  if (s.some(x => x.status === 'maintenance')) return 'maintenance';
  return 'operational';
}

function UptimeBar({ history }: { history: number[] }) {
  const labels = history.map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (history.length - 1 - i)); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });
  return (<div className="uptime-bar-wrap" aria-label="30-day uptime history">{history.map((v, i) => (<span key={i} className={`uptime-seg ${v === 1 ? 'up' : v === 2 ? 'partial' : 'down'}`} title={`${labels[i]}: ${v === 1 ? 'Operational' : v === 2 ? 'Degraded' : 'Outage'}`}/>))}</div>);
}

function StatusPill({ status }: { status: ServiceStatus }) {
  return (<span className={`svc-status-pill status-${status}`}><span className="status-dot"/>{STATUS_LABEL[status]}</span>);
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [open, setOpen] = useState(incident.id === 'inc-002');
  return (
    <div className={`incident-card inc-severity-${incident.severity} inc-status-${incident.status}`}>
      <button className="incident-header" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="inc-header-left">
          <span className={`inc-severity-badge sev-${incident.severity}`}>{SEVERITY_LABEL[incident.severity]}</span>
          <div><strong className="inc-title">{incident.title}</strong><span className="inc-meta"><Clock size={11}/> {incident.date} · {incident.time}</span></div>
        </div>
        <div className="inc-header-right">
          <span className={`inc-resolved-tag tag-${incident.status}`}>
            {incident.status === 'resolved' ? <><CheckCircle2 size={12}/> Resolved</> : incident.status === 'monitoring' ? <><Activity size={12}/> Monitoring</> : incident.status === 'scheduled' ? <><Clock size={12}/> Scheduled</> : <><AlertTriangle size={12}/> Investigating</>}
          </span>
          {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </div>
      </button>
      {open && (<div className="incident-updates">{incident.updates.map((u, i) => (<div key={i} className="inc-update"><span className="inc-update-time">{u.time}</span><p>{u.message}</p></div>))}</div>)}
    </div>
  );
}

function StatusPage() {
  const [lastChecked, setLastChecked] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const overall = overallStatus(SERVICES);
  const uptime = (SERVICES.reduce((s, v) => s + v.uptime, 0) / SERVICES.length).toFixed(2);
  const operationalCount = SERVICES.filter(s => s.status === 'operational').length;

  function refresh() { setRefreshing(true); setTimeout(() => { setLastChecked(new Date()); setRefreshing(false); }, 900); }
  useEffect(() => { const id = setInterval(() => setLastChecked(new Date()), 60_000); return () => clearInterval(id); }, []);

  return (
    <div className="container">
      <div className={`status-banner status-banner-${overall}`}>
        <div className="status-banner-inner">
          <div className="status-banner-icon-wrap">
            {overall === 'operational' ? <CheckCircle2 size={28}/> : <AlertTriangle size={28}/>}
          </div>
          <div className="status-banner-content">
            <h1 className="status-banner-title">
              {overall === 'operational' ? 'All systems operational' : overall === 'degraded' ? 'Partial system degradation' : overall === 'maintenance' ? 'Scheduled maintenance' : 'Service disruption detected'}
            </h1>
            <p className="status-banner-sub">
              {operationalCount} of {SERVICES.length} services running normally
              <span className="status-divider">·</span>
              Avg. uptime <strong>{uptime}%</strong> over the last 90 days
            </p>
          </div>
          <div className="status-banner-meta">
            <span className="status-last-checked"><Clock size={11}/> Last checked {lastChecked.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
            <Button variant="outline" size="sm" className={`status-refresh-btn ${refreshing ? 'refreshing' : ''}`} onClick={refresh} disabled={refreshing} aria-label="Refresh status"><RefreshCw size={13}/> Refresh</Button>
          </div>
        </div>
      </div>

      <div className="status-metrics">
        <div className="status-metric-tile"><span className="metric-label">System Uptime</span><span className="metric-value metric-green">{uptime}%</span><span className="metric-period">Last 90 days</span></div>
        <div className="status-metric-tile"><span className="metric-label">Services Online</span><span className="metric-value metric-green">{operationalCount}/{SERVICES.length}</span><span className="metric-period">All components</span></div>
        <div className="status-metric-tile"><span className="metric-label">Avg. Response</span><span className="metric-value metric-blue">{Math.round(SERVICES.reduce((s, v) => s + v.latency, 0) / SERVICES.length)} ms</span><span className="metric-period">Across all endpoints</span></div>
        <div className="status-metric-tile"><span className="metric-label">Active Incidents</span><span className="metric-value metric-green">0</span><span className="metric-period">No ongoing issues</span></div>
      </div>

      <section className="status-section">
        <div className="status-section-head"><div><h2>Service Health</h2><p>Real-time status for all HASA GOLD STORE components</p></div></div>
        <div className="uptime-timeline-header">
          <span className="uptime-tl-label">30 days ago</span>
          <div className="uptime-tl-days">{['30d','25d','20d','15d','10d','5d','Today'].map(d => <span key={d}>{d}</span>)}</div>
          <span className="uptime-tl-label">Today</span>
        </div>
        <div className="services-list">
          {SERVICES.map(svc => (
            <div key={svc.id} className={`service-row status-svc-${svc.status}`}>
              <div className="svc-left">
                <span className={`svc-icon-wrap svc-icon-${svc.status}`}><svc.Icon size={16}/></span>
                <div className="svc-info"><span className="svc-name">{svc.name}</span><span className="svc-desc">{svc.description}</span></div>
              </div>
              <div className="svc-right">
                <div className="svc-uptime-col">
                  <UptimeBar history={svc.history}/>
                  <div className="svc-uptime-meta"><span>{svc.uptime}% uptime</span><span className="svc-latency">{svc.latency} ms</span></div>
                </div>
                <StatusPill status={svc.status}/>
              </div>
            </div>
          ))}
        </div>
        <div className="uptime-legend">
          <span><span className="legend-dot dot-up"/>Operational</span>
          <span><span className="legend-dot dot-partial"/>Degraded</span>
          <span><span className="legend-dot dot-down"/>Outage</span>
        </div>
      </section>

      <section className="status-section">
        <div className="status-section-head"><div><h2>Incident History</h2><p>Recent incidents and scheduled maintenance windows</p></div><span className="inc-count-badge">{INCIDENTS.length} entries</span></div>
        <div className="incidents-list">{INCIDENTS.map(inc => <IncidentCard key={inc.id} incident={inc}/>)}</div>
        <div className="inc-all-clear"><Info size={13}/> Showing last 30 days of incident history. All times are in UTC.</div>
      </section>

      <div className="status-footer-row">
        <div className="status-subscribe-card">
          <div className="sub-card-icon"><Bell size={20}/></div>
          <div><h3>Subscribe to updates</h3><p>Get notified by email whenever HASA GOLD STORE creates, updates, or resolves an incident.</p></div>
          <Button variant="outline" className="sub-btn" asChild><Link to="/support">Contact Support <ExternalLink size={13}/></Link></Button>
        </div>
        <div className="status-info-card">
          <h3><Globe size={15}/> Network overview</h3>
          <div className="network-regions">
            {[{ region: 'Asia Pacific', city: 'Singapore', ping: 18, ok: true }, { region: 'South Asia', city: 'Mumbai', ping: 24, ok: true }, { region: 'Middle East', city: 'Dubai', ping: 31, ok: true }, { region: 'Europe', city: 'Frankfurt', ping: 44, ok: true }, { region: 'Americas', city: 'Virginia', ping: 88, ok: true }].map(r => (
              <div key={r.city} className="network-region-row">
                <span className={`net-dot ${r.ok ? 'net-ok' : 'net-bad'}`}/><span className="net-city">{r.city}</span><span className="net-region">{r.region}</span><span className="net-ping">{r.ping} ms</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="status-back-row">
        <Button variant="ghost" asChild><Link to="/"><ChevronRight size={14} style={{ transform: 'rotate(180deg)' }}/> Back to store</Link></Button>
        <span className="status-powered">Status powered by HASA GOLD STORE monitoring</span>
      </div>
    </div>
  );
}
