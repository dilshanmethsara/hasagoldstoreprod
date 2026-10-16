import diamonds from '@/assets/diamond-world.jpg';
import bloodStrikeLogo from '@/assets/blood-strike.jpg';
import battle from '@/assets/battle-world.jpg';
import ops from '@/assets/ops-world.jpg';
import ffAcc from '@/assets/ff-account.jpg';
import pubgAcc from '@/assets/pubg-account.jpg';
import codmAcc from '@/assets/codm-account.jpg';
import bsAcc from '@/assets/bs-account.jpg';
import freefireLogo from '@/assets/freefire.jfif';
import pubgLogo from '@/assets/pubgmobilelogo.jpg';
import codmLogo from '@/assets/call-of-duty-mobile-logo.jpg';

export const games = [
  { id: 'free-fire', name: 'Free Fire', currency: 'Diamonds', image: freefireLogo, tone: 'ice', icon: 'diamond', logo: freefireLogo, packs: [100, 310, 520, 1060, 2180, 5600] },
  { id: 'blood-strike', name: 'Blood Strike', currency: 'Gold', image: bloodStrikeLogo, tone: 'ember', icon: 'coins', logo: bloodStrikeLogo, packs: [100, 300, 500, 1000, 2000, 5000] },
  { id: 'pubg-mobile', name: 'PUBG Mobile', currency: 'UC', image: pubgLogo, tone: 'olive', icon: 'coins', logo: pubgLogo, packs: [60, 325, 660, 1800, 3850, 8100] },
  { id: 'call-of-duty-mobile', name: 'Call of Duty: Mobile', currency: 'CP', image: codmLogo, tone: 'violet', icon: 'coins', logo: codmLogo, packs: [80, 400, 800, 2000, 4000, 8000] },
] as const;

export type Game = (typeof games)[number] & { logo: string | null };

export interface GameAccount {
  id: string;
  gameId: 'free-fire' | 'pubg-mobile' | 'blood-strike' | 'call-of-duty-mobile';
  gameName: string;
  title: string;
  tagline: string;
  priceSample: string;
  level: number;
  rank: string;
  server: string;
  loginType: string;
  image: string;
  tone: 'ice' | 'ember' | 'olive' | 'violet';
  verified: boolean;
  status: 'Available' | 'Reserved';
  badges: readonly string[];
  inventoryHighlights: readonly string[];
  description: string;
  features: readonly { label: string; value: string }[];
}

export const gameAccounts: readonly GameAccount[] = [
  {
    id: 'ff-grandmaster-sakura',
    gameId: 'free-fire',
    gameName: 'Free Fire',
    title: 'Grandmaster S34 · Sakura + Hip Hop + 7 Max Evo Guns',
    tagline: 'Old-school OG Season 1 & 2 Elite Pass account with Max Level MP40 Cobra & AK47 Blue Flame Draco.',
    priceSample: '$165',
    level: 75,
    rank: 'Grandmaster (Top 0.1%)',
    server: 'Global / Asia',
    loginType: 'Clean Google Mail (Full Access)',
    image: ffAcc,
    tone: 'ice',
    verified: true,
    status: 'Available',
    badges: ['Instant Handover', 'Clean Binding', '7 Max Evos', 'OG Sakura Pass'],
    inventoryHighlights: [
      'Season 1 & 2 Sakura & Hip Hop Elite Bundles',
      'MP40 Cobra Evo Gun (Max Level 7)',
      'AK47 Blue Flame Draco (Max Level 7)',
      'SCAR Megalodon Alpha (Max Level 7)',
      'Red & Green Criminal Rare Costumes',
      '19,500 Profile Likes & Top Guild Status',
    ],
    description:
      'A legendary collector Free Fire account with ultra-rare Season 1 and Season 2 passes. Fully unlocked evo animations, emote slots, and clean single-bind email with zero linked third-party social accounts.',
    features: [
      { label: 'Level', value: 'Level 75' },
      { label: 'Rank', value: 'Grandmaster S34' },
      { label: 'Evo Weapons', value: '7 Maxed (Level 7)' },
      { label: 'Elite Passes', value: 'Season 1 to Current' },
      { label: 'Binding', value: 'Clean Gmail (Transferable)' },
      { label: 'Server', value: 'Global / Asia' },
    ],
  },
  {
    id: 'pubg-pharaoh-glacier',
    gameId: 'pubg-mobile',
    gameName: 'PUBG Mobile',
    title: 'Conqueror S18 · Pharaoh X-Suit Lv.6 + M416 Glacier Max',
    tagline: 'High-tier battle royale account featuring upgraded Glacier M416 with on-hit effect & loot crate.',
    priceSample: '$240',
    level: 75,
    rank: 'Conqueror (Season 14 & 18)',
    server: 'Global / Asia',
    loginType: 'Twitter & Clean Email Bind',
    image: pubgAcc,
    tone: 'olive',
    verified: true,
    status: 'Available',
    badges: ['Conqueror Frame', 'Glacier M416 Max', 'Pharaoh X-Suit', '62 Mythics'],
    inventoryHighlights: [
      'M416 Glacier Level 7 (Loot Crate & On-Hit Effect)',
      'Pharaoh X-Suit Upgraded to Level 6 (Final Form)',
      'Mythic Fashion Title with 62 Mythic Outfits',
      'Fool M416 Level 4 (Elimination Broadcast)',
      'Armored UAZ & Golden Feather Dacia Skins',
      '45,980 UC Worth of Unopened Crates & Materials',
    ],
    description:
      'Premier PUBG Mobile competitive account with Conqueror avatar frames and titles. Loaded with the most coveted weapon skin in the game (Glacier M416 Max) and Pharaoh X-Suit. Ready for immediate competitive or casual gameplay.',
    features: [
      { label: 'Level', value: 'Level 75' },
      { label: 'Rank', value: 'Conqueror S14, S18' },
      { label: 'Mythic Count', value: '62 Mythic Outfits' },
      { label: 'Key Weapon', value: 'M416 Glacier Max (Lv 7)' },
      { label: 'X-Suit', value: 'Golden Pharaoh (Lv 6)' },
      { label: 'Binding', value: 'Twitter + Changeable Mail' },
    ],
  },
  {
    id: 'codm-ghost-mythic',
    gameId: 'call-of-duty-mobile',
    gameName: 'Call of Duty: Mobile',
    title: 'Legendary MP & BR · Ghost Redux Operator + Mythic FFAR 1',
    tagline: 'Dual-Legendary account with Ghost Redux legendary operator dog companion & Damascus master camos.',
    priceSample: '$180',
    level: 150,
    rank: 'Legendary Rank 1 (MP & BR)',
    server: 'Global',
    loginType: 'Activision Clean Account',
    image: codmAcc,
    tone: 'violet',
    verified: true,
    status: 'Available',
    badges: ['Max Level 150', 'Mythic FFAR 1', 'Ghost Redux', 'Damascus Unlocked'],
    inventoryHighlights: [
      'Legendary Ghost - Retribution with Riley Dog Companion',
      'Mythic FFAR 1 - Bright Blade (Max Upgraded)',
      'Mythic Kilo 141 - Demonsong',
      'Full Damascus Camo Unlocked Across All Weapon Categories',
      '14 Legendary Weapons with Custom Inspection Animations',
      'Season 1-12 OG Battle Pass Character Outfits',
    ],
    description:
      'Max Level 150 Call of Duty Mobile profile boasting dual Legendary rank in both Multiplayer and Battle Royale. Features the iconic Legendary Ghost skin and top-tier Mythic loadouts with full Damascus mastery.',
    features: [
      { label: 'Level', value: 'Max Level 150' },
      { label: 'Rank', value: 'Dual Legendary (MP + BR)' },
      { label: 'Mythic Weapons', value: 'FFAR 1 & Kilo 141' },
      { label: 'Mastery Camo', value: 'Damascus (All Guns)' },
      { label: 'Operator', value: 'Legendary Ghost + K9' },
      { label: 'Binding', value: 'Clean Activision Account' },
    ],
  },
  {
    id: 'bs-legend-damascus',
    gameId: 'blood-strike',
    gameName: 'Blood Strike',
    title: 'Legend Rank S8 · Aetheric Spec-Ops + Gold Damascus M4',
    tagline: 'Top 50 leaderboard account with 68% Win Rate, 2.15 K/D, and all seasonal Ultra weapon skins.',
    priceSample: '$110',
    level: 95,
    rank: 'Legend Rank (Top 50 Server)',
    server: 'Global / Americas',
    loginType: 'Clean Email Direct Login',
    image: bsAcc,
    tone: 'ember',
    verified: true,
    status: 'Available',
    badges: ['Top 50 Leaderboard', '68% Win Rate', 'Gold Damascus', 'Clean Binding'],
    inventoryHighlights: [
      'Aetheric Spec-Ops Legendary Operator Skin',
      'Gold Damascus Assault Rifle Camo Set',
      '68% Ranked Win Rate with 2.15 K/D Ratio',
      '142 In-Game Lifetime Achievements Unlocked',
      'Complete Battle Pass Rewards from Season 1 to 8',
      'Exclusive Ultra Melee Weapon & Tactical Emotes',
    ],
    description:
      'Top-tier competitive Blood Strike account holding Legend Rank in Cyberia. High stats and complete mastery camos with instant credential transfer to the buyer.',
    features: [
      { label: 'Level', value: 'Level 95 (Max Tier)' },
      { label: 'Rank', value: 'Legend Rank (Top 50)' },
      { label: 'Win Rate', value: '68% Ranked Win Rate' },
      { label: 'K/D Ratio', value: '2.15 Competitive K/D' },
      { label: 'Mastery', value: 'Gold Damascus Camos' },
      { label: 'Binding', value: 'Single Clean Email' },
    ],
  },
  {
    id: 'ff-evo-scar-megalodon',
    gameId: 'free-fire',
    gameName: 'Free Fire',
    title: 'Master Tier · SCAR Megalodon Max + Yellow Poker MP40',
    tagline: 'Competitive tournament-ready profile with high headshot percentage & rare Incubator bundles.',
    priceSample: '$95',
    level: 71,
    rank: 'Master Tier',
    server: 'Global / South Asia',
    loginType: 'Google Play Clean Transfer',
    image: diamonds,
    tone: 'ice',
    verified: true,
    status: 'Available',
    badges: ['Master Tier', 'Megalodon SCAR', 'Poker MP40', 'Verified ID'],
    inventoryHighlights: [
      'SCAR Megalodon Alpha (Max Level 7 with Finisher)',
      'Yellow Flashing Spade Poker MP40 Incubator',
      'Arctic Blue & Blue Phoenix Rare Costumes',
      'Alok, Chrono, and Homer Maxed Skill Trees',
      '14,200 Profile Commendations & Custom Rooms',
    ],
    description:
      'High-performance tournament account configured with the best weapon fire-rate attributes. Clean Google login ready for instant ownership reassignment.',
    features: [
      { label: 'Level', value: 'Level 71' },
      { label: 'Rank', value: 'Master Tier' },
      { label: 'Key Weapon', value: 'SCAR Megalodon (Lv 7)' },
      { label: 'Incubator', value: 'Yellow Poker MP40' },
      { label: 'Characters', value: 'All Meta Skills Maxed' },
      { label: 'Binding', value: 'Clean Google Account' },
    ],
  },
  {
    id: 'pubg-fool-m416',
    gameId: 'pubg-mobile',
    gameName: 'PUBG Mobile',
    title: 'Crown Tier · M416 The Fool Max + Blood Raven X-Suit',
    tagline: 'Stacked inventory with iconic Laughing Jack-in-the-Box death crate and Blood Raven X-Suit.',
    priceSample: '$195',
    level: 72,
    rank: 'Crown Tier',
    server: 'Global / Europe',
    loginType: 'Twitter & Clean Mail Link',
    image: battle,
    tone: 'olive',
    verified: true,
    status: 'Available',
    badges: ['Fool M416 Max', 'Blood Raven X-Suit', 'UAZ Armored', 'Verified'],
    inventoryHighlights: [
      'The Fool M416 Level 7 (Loot Crate Animation)',
      'Blood Raven X-Suit (Upgraded Form)',
      'Golden Feather Dacia & Armored UAZ Vehicle Skins',
      'S12 to S19 Consecutive 100 RP Max Outfits',
      'Over 35 Upgraded Weapon Paint Finishes',
    ],
    description:
      'One of the most recognized weapon skins in PUBG Mobile history. Comes with the animated Fool loot crate and Blood Raven X-suit with clean single-binding.',
    features: [
      { label: 'Level', value: 'Level 72' },
      { label: 'Rank', value: 'Crown Tier' },
      { label: 'Key Weapon', value: 'The Fool M416 (Lv 7)' },
      { label: 'X-Suit', value: 'Blood Raven Form' },
      { label: 'Vehicles', value: 'Armored UAZ + Dacia' },
      { label: 'Binding', value: 'Twitter + Clean Mail' },
    ],
  },
];

export const faqs = [
  { question: 'Can I buy game accounts right now?', answer: 'This is a frontend preview of HASA GOLD STORE. Game accounts and top-ups are sample listings to demonstrate the catalog, inventory inspect, and safe credential handover workflow. No real payments are processed.' },
  { question: 'How does game account transfer work?', answer: 'In our verified process, all listed accounts come with clean bindings (e.g., dedicated Gmail, Activision ID, or Twitter). Upon purchase, the buyer receives complete login credentials and instructions to change the recovery email, password, and two-factor authentication.' },
  { question: 'Are the game accounts safe from recovery?', answer: 'Yes. Every listed account undergoes rigorous inspection to ensure no unlinked phone numbers, active recovery appeals, or secondary ties exist. Full email account ownership is transferred directly to the buyer.' },
  { question: 'Can I buy a top-up right now?', answer: 'Not yet. All top-up packages are marked Sample in this preview mode, and no real orders or payments are processed.' },
  { question: 'Which games can I browse?', answer: 'Explore Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile. Each game has its own top-up packages and high-tier account listings.' },
  { question: 'Do I need to share my password for top-ups?', answer: 'No. Top-up services require only your public Player ID/UID. You never need to share your game password for top-up delivery.' },
  { question: 'How do favorites work?', answer: 'Select the heart next to any game or account to add it to Favorites. Your choices stay available while you browse during this session.' },
];

export function pageHead(title: string, description: string) {
  return {
    meta: [
      { title: `${title} | HASA GOLD STORE` },
      { name: 'description', content: description },
      { property: 'og:title', content: `${title} | HASA GOLD STORE` },
      { property: 'og:description', content: description },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  };
}