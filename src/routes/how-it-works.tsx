import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageIntro, Steps, SupportBand } from '@/components/store-ui';
import { pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/how-it-works')({ head: () => pageHead('How it works', 'Learn how to browse games, choose sample top-up packages, and review selections at HASA GOLD STORE.'), component: HowPage });
function HowPage() { return <div className="container page-content"><PageIntro eyebrow="THREE SIMPLE STEPS" title="Less fuss. More play." description="Find your game, explore a package, and review your selection."/><Steps full/><div className="notice"><strong>A preview, not a purchase.</strong><br/>All artwork and top-up options are Sample. You can explore and review a selection, but no order is placed and no payment is taken. Confirmed prices, delivery details, and store policies have not been added yet.</div><Button asChild><Link to="/games">Find your game <ArrowRight/></Link></Button><SupportBand/></div>; }