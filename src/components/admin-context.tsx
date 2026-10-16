import { createContext, useContext, useState, type ReactNode } from 'react';
import { games, gameAccounts, faqs, type GameAccount } from '@/lib/store-data';

export type AdminGame = {
  id: string;
  name: string;
  currency: string;
  image: string;
  tone: string;
  enabled: boolean;
  packs: number[];
};

export type AdminFaq = { question: string; answer: string };

export type AdminAccountListing = {
  id: string;
  gameId: string;
  gameName: string;
  title: string;
  tagline: string;
  priceSample: string;
  level: number;
  rank: string;
  server: string;
  loginType: string;
  image: string;
  tone: string;
  verified: boolean;
  status: 'Available' | 'Reserved' | 'Sold';
  badges: string[];
  inventoryHighlights: string[];
  description: string;
  features: { label: string; value: string }[];
};

export type AdminOrder = {
  id: string;
  type: 'topup' | 'account';
  customerName: string;
  customerContact: string;
  item: string;
  amount: string;
  paymentMethod: string;
  status: 'Completed' | 'Processing' | 'Pending' | 'Refunded';
  playerId?: string;
  date: string;
};

export type AdminService = {
  id: string;
  name: string;
  category: string;
  status: 'operational' | 'degraded' | 'maintenance' | 'outage';
  uptime: string;
  latency: number;
};

export type AdminIncident = {
  id: string;
  title: string;
  status: 'Investigating' | 'Identified' | 'Monitoring' | 'Resolved';
  impact: 'None' | 'Minor' | 'Major';
  date: string;
  updates: { time: string; text: string }[];
};

export type AdminTicket = {
  id: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  category: 'Top-up Speed' | 'Account Escrow' | 'Player ID' | 'Refund' | 'General';
  priority: 'High' | 'Normal' | 'Low';
  status: 'Open' | 'In Progress' | 'Resolved';
  date: string;
  messages: { sender: string; text: string; time: string }[];
};

export type AdminStoreSettings = {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportWhatsapp: string;
  currency: string;
  instantEscrowEnabled: boolean;
  bannerEnabled: boolean;
  bannerText: string;
  bannerTone: 'gold' | 'ice' | 'ember' | 'emerald';
  maintenanceMode: boolean;
};

export type AdminPolicies = {
  privacyVersion: string;
  privacyLastUpdated: string;
  privacyEffectiveDate: string;
  refundVersion: string;
  refundLastUpdated: string;
  refundGuaranteeWindow: string;
};

const initialGames = (): AdminGame[] =>
  games.map(game => ({
    id: game.id,
    name: game.name,
    currency: game.currency,
    image: game.image,
    tone: game.tone,
    enabled: true,
    packs: [...game.packs],
  }));

const initialAccounts = (): AdminAccountListing[] =>
  gameAccounts.map(acc => ({
    ...acc,
    badges: [...acc.badges],
    inventoryHighlights: [...acc.inventoryHighlights],
    features: acc.features.map(f => ({ ...f })),
  }));

const initialOrders: AdminOrder[] = [
  { id: 'ORD-8821', type: 'topup', customerName: 'Rafi Hasan', customerContact: 'rafi.gamer@gmail.com', item: 'Free Fire · 2,180 Diamonds', amount: '$19.99', paymentMethod: 'bKash', status: 'Completed', playerId: '894120381 (Asia)', date: '12 mins ago' },
  { id: 'ACC-4091', type: 'account', customerName: 'Tariq Rahman', customerContact: '+880 1711-998822', item: 'Conqueror S18 · Pharaoh X-Suit + M416 Glacier', amount: '$240.00', paymentMethod: 'Binance USDT', status: 'Processing', playerId: 'Escrow Handover', date: '34 mins ago' },
  { id: 'ORD-8820', type: 'topup', customerName: 'Kamal Ahmed', customerContact: 'kamal.strike@gmail.com', item: 'Blood Strike · 1,000 Gold', amount: '$9.99', paymentMethod: 'Nagad', status: 'Completed', playerId: 'BS-9912401', date: '1 hour ago' },
  { id: 'ORD-8819', type: 'topup', customerName: 'Siam Chowdhury', customerContact: 'siam.pubg@gmail.com', item: 'PUBG Mobile · 1,800 UC', amount: '$24.99', paymentMethod: 'Rocket', status: 'Processing', playerId: '5129840192', date: '2 hours ago' },
  { id: 'ACC-4089', type: 'account', customerName: 'Alex Mercer', customerContact: 'alex.m@proton.me', item: 'Blood Strike · Legend Damascus + Gold Katana', amount: '$149.00', paymentMethod: 'Visa / Mastercard', status: 'Completed', playerId: 'Escrow Released', date: '5 hours ago' },
  { id: 'ORD-8818', type: 'topup', customerName: 'Farhan Ali', customerContact: 'farhan.codm@outlook.com', item: 'Call of Duty: Mobile · 5,000 CP', amount: '$39.99', paymentMethod: 'bKash', status: 'Completed', playerId: '67491029312', date: '8 hours ago' },
  { id: 'ORD-8817', type: 'topup', customerName: 'Naimur Rahman', customerContact: 'naimur99@gmail.com', item: 'Free Fire · 5,600 Diamonds', amount: '$49.99', paymentMethod: 'Binance Pay', status: 'Pending', playerId: '291039481', date: '10 hours ago' },
  { id: 'ORD-8816', type: 'topup', customerName: 'Mahir Faisal', customerContact: 'mahir.f@gmail.com', item: 'PUBG Mobile · 600 UC', amount: '$7.99', paymentMethod: 'Nagad', status: 'Refunded', playerId: '591029381', date: '1 day ago' },
];

const initialServices: AdminService[] = [
  { id: 'ff-gateway', name: 'Free Fire Direct Gateway', category: 'Game API', status: 'operational', uptime: '99.99%', latency: 68 },
  { id: 'bs-api', name: 'Blood Strike API Server', category: 'Game API', status: 'operational', uptime: '99.95%', latency: 84 },
  { id: 'pubg-topup', name: 'PUBG Mobile Top-up System', category: 'Game API', status: 'operational', uptime: '99.98%', latency: 112 },
  { id: 'codm-gateway', name: 'Call of Duty: Mobile Gateway', category: 'Game API', status: 'operational', uptime: '99.92%', latency: 95 },
  { id: 'payment-gw', name: 'Payment Gateway & Processing', category: 'Fintech', status: 'operational', uptime: '100.0%', latency: 142 },
  { id: 'escrow-svc', name: 'Account Transfer Escrow Service', category: 'Escrow', status: 'operational', uptime: '99.97%', latency: 160 },
  { id: 'id-verify', name: 'Player ID Instant Verification', category: 'Validation', status: 'operational', uptime: '99.94%', latency: 45 },
  { id: 'auth-sync', name: 'User Auth & Cloud Sync', category: 'Core', status: 'operational', uptime: '100.0%', latency: 52 },
  { id: 'cdn-edge', name: 'Web Storefront & Edge CDN', category: 'Infrastructure', status: 'operational', uptime: '100.0%', latency: 18 },
];

const initialIncidents: AdminIncident[] = [
  {
    id: 'INC-2026-10',
    title: 'Garena API Scheduled Gateway Latency',
    status: 'Resolved',
    impact: 'Minor',
    date: 'Oct 12, 2026',
    updates: [
      { time: '14:30 UTC', text: 'All direct top-up queues cleared. Delivery latency restored to sub-60 seconds.' },
      { time: '13:45 UTC', text: 'Downstream partner reported elevated response times during database migration.' },
    ],
  },
];

const initialTickets: AdminTicket[] = [
  {
    id: 'TCK-104',
    customerName: 'Rafi Hasan',
    customerEmail: 'rafi.gamer@gmail.com',
    subject: 'When will my 2,180 Free Fire Diamonds arrive?',
    category: 'Top-up Speed',
    priority: 'High',
    status: 'In Progress',
    date: '15 mins ago',
    messages: [
      { sender: 'Rafi Hasan', text: 'Hi, I paid with bKash TrxID #91823. Just checking when the diamonds will show in-game.', time: '15 mins ago' },
      { sender: 'Admin Support', text: 'Hello Rafi! Your payment was verified. Diamonds are in instant batch queue.', time: '10 mins ago' },
    ],
  },
  {
    id: 'TCK-103',
    customerName: 'Tanvir Hossain',
    customerEmail: 'tanvir.h@outlook.com',
    subject: 'How does the Game Account Escrow handover work?',
    category: 'Account Escrow',
    priority: 'Normal',
    status: 'Open',
    date: '45 mins ago',
    messages: [
      { sender: 'Tanvir Hossain', text: 'I want to buy the Conqueror Pharaoh PUBG account. Can I change email binding first before releasing funds?', time: '45 mins ago' },
    ],
  },
  {
    id: 'TCK-102',
    customerName: 'Joy Hasan',
    customerEmail: 'joy.hasan@yahoo.com',
    subject: 'Changed my Player ID before payment was submitted',
    category: 'Player ID',
    priority: 'Normal',
    status: 'Resolved',
    date: '2 hours ago',
    messages: [
      { sender: 'Joy Hasan', text: 'Entered wrong digit on blood strike ID BS-9912401.', time: '2 hours ago' },
      { sender: 'Admin Support', text: 'ID corrected in the dispatch queue. Order #ORD-8820 delivered successfully!', time: '1 hour ago' },
    ],
  },
  {
    id: 'TCK-101',
    customerName: 'Mim Akter',
    customerEmail: 'mim.akter@gmail.com',
    subject: 'Refund policy inquiry regarding COD Mobile maintenance',
    category: 'Refund',
    priority: 'Low',
    status: 'Resolved',
    date: '1 day ago',
    messages: [
      { sender: 'Mim Akter', text: 'Under what conditions does the 100% money back guarantee apply?', time: '1 day ago' },
      { sender: 'Admin Support', text: 'If order fails to deliver within 24 hours, instant full refund is guaranteed.', time: '1 day ago' },
    ],
  },
];

const initialSettings: AdminStoreSettings = {
  storeName: 'HASA GOLD STORE',
  tagline: 'Direct Game Top-ups & Verified Account Escrow',
  supportEmail: 'support@hasagold.store',
  supportWhatsapp: '+880 1700-123456',
  currency: 'USD ($)',
  instantEscrowEnabled: true,
  bannerEnabled: true,
  bannerText: '🔥 Flash Sale: Extra 15% Bonus on all Free Fire & PUBG Mobile top-ups today only!',
  bannerTone: 'gold',
  maintenanceMode: false,
};

const initialPolicies: AdminPolicies = {
  privacyVersion: 'v2.4',
  privacyLastUpdated: 'October 2026',
  privacyEffectiveDate: 'October 15, 2026',
  refundVersion: 'v1.9',
  refundLastUpdated: 'October 2026',
  refundGuaranteeWindow: '24 Hours Full Money-Back Guarantee',
};

function useAdminState() {
  const [catalog, setCatalog] = useState<AdminGame[]>(initialGames);
  const [accounts, setAccounts] = useState<AdminAccountListing[]>(initialAccounts);
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [services, setServices] = useState<AdminService[]>(initialServices);
  const [incidents, setIncidents] = useState<AdminIncident[]>(initialIncidents);
  const [tickets, setTickets] = useState<AdminTicket[]>(initialTickets);
  const [settings, setSettings] = useState<AdminStoreSettings>(initialSettings);
  const [policies, setPolicies] = useState<AdminPolicies>(initialPolicies);
  const [answers, setAnswers] = useState<AdminFaq[]>(() => faqs.map(item => ({ ...item })));
  const [activity, setActivity] = useState<string[]>([
    'System initialized with 4 catalog games & 6 marketplace accounts',
    'Service status monitors running at 99.98% overall uptime',
  ]);

  const record = (text: string) => setActivity(items => [text, ...items].slice(0, 15));

  // Games
  const changeGame = (id: string, values: Partial<AdminGame>) => {
    setCatalog(items => items.map(item => (item.id === id ? { ...item, ...values } : item)));
    record(`Updated game draft: ${id}`);
  };

  const addGame = (game: AdminGame) => {
    setCatalog(items => [...items, game]);
    record(`Added new game listing: ${game.name}`);
  };

  // Accounts Marketplace
  const changeAccount = (id: string, values: Partial<AdminAccountListing>) => {
    setAccounts(items => items.map(item => (item.id === id ? { ...item, ...values } : item)));
    record(`Updated game account: ${id}`);
  };

  const changeAccountStatus = (id: string, status: 'Available' | 'Reserved' | 'Sold') => {
    setAccounts(items => items.map(item => (item.id === id ? { ...item, status } : item)));
    record(`Changed account ${id} status to ${status}`);
  };

  const addAccount = (account: AdminAccountListing) => {
    setAccounts(items => [account, ...items]);
    record(`Listed new game account: ${account.title}`);
  };

  const removeAccount = (id: string) => {
    setAccounts(items => items.filter(item => item.id !== id));
    record(`Removed game account: ${id}`);
  };

  // Orders
  const updateOrderStatus = (orderId: string, status: AdminOrder['status']) => {
    setOrders(items => items.map(o => (o.id === orderId ? { ...o, status } : o)));
    record(`Order ${orderId} status set to ${status}`);
  };

  const addOrder = (newOrder: AdminOrder) => {
    setOrders(items => [newOrder, ...items]);
    record(`New ${newOrder.type} order placed: ${newOrder.id} (${newOrder.customerName})`);
  };

  // Services & Incidents
  const updateServiceStatus = (serviceId: string, status: AdminService['status']) => {
    setServices(items => items.map(s => (s.id === serviceId ? { ...s, status } : s)));
    record(`Service ${serviceId} status changed to ${status}`);
  };

  const addIncident = (title: string, impact: AdminIncident['impact'], initialUpdate: string) => {
    const newInc: AdminIncident = {
      id: `INC-2026-${Date.now().toString().slice(-4)}`,
      title,
      status: 'Investigating',
      impact,
      date: 'Just now',
      updates: [{ time: 'Just now', text: initialUpdate }],
    };
    setIncidents(items => [newInc, ...items]);
    record(`Reported new system incident: ${title}`);
  };

  const resolveIncident = (id: string, note: string) => {
    setIncidents(items =>
      items.map(inc =>
        inc.id === id
          ? {
              ...inc,
              status: 'Resolved',
              updates: [{ time: 'Just now', text: note || 'Issue resolved. All metrics operational.' }, ...inc.updates],
            }
          : inc
      )
    );
    record(`Resolved incident ${id}`);
  };

  // Support Tickets
  const updateTicketStatus = (ticketId: string, status: AdminTicket['status']) => {
    setTickets(items => items.map(t => (t.id === ticketId ? { ...t, status } : t)));
    record(`Ticket ${ticketId} status changed to ${status}`);
  };

  const replyTicket = (ticketId: string, replyText: string) => {
    setTickets(items =>
      items.map(t =>
        t.id === ticketId
          ? {
              ...t,
              status: 'In Progress',
              messages: [...t.messages, { sender: 'Admin Support', text: replyText, time: 'Just now' }],
            }
          : t
      )
    );
    record(`Replied to ticket ${ticketId}`);
  };

  // Store Settings & Policies
  const updateStoreSettings = (values: Partial<AdminStoreSettings>) => {
    setSettings(prev => ({ ...prev, ...values }));
    record('Store settings updated');
  };

  const updatePolicies = (values: Partial<AdminPolicies>) => {
    setPolicies(prev => ({ ...prev, ...values }));
    record('Policy metadata updated');
  };

  const reset = () => {
    setCatalog(initialGames());
    setAccounts(initialAccounts());
    setOrders(initialOrders);
    setServices(initialServices);
    setIncidents(initialIncidents);
    setTickets(initialTickets);
    setSettings(initialSettings);
    setPolicies(initialPolicies);
    setAnswers(faqs.map(item => ({ ...item })));
    setActivity(['Workspace reset to default sample data']);
  };

  return {
    catalog,
    changeGame,
    addGame,
    accounts,
    changeAccount,
    changeAccountStatus,
    addAccount,
    removeAccount,
    orders,
    updateOrderStatus,
    addOrder,
    services,
    updateServiceStatus,
    incidents,
    addIncident,
    resolveIncident,
    tickets,
    updateTicketStatus,
    replyTicket,
    settings,
    updateStoreSettings,
    policies,
    updatePolicies,
    answers,
    setAnswers,
    activity,
    record,
    reset,
  };
}

const Context = createContext<ReturnType<typeof useAdminState> | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const existing = useContext(Context);
  if (existing) return <>{children}</>;
  const value = useAdminState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAdmin() {
  const value = useContext(Context);
  if (!value) throw new Error('Admin provider missing');
  return value;
}
