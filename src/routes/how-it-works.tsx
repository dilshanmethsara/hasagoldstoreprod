import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageIntro, Steps, SupportBand } from "@/components/store-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/how-it-works")({
  head: () =>
    pageHead(
      "How it works",
      "Learn how to browse the live game catalog and create an unpaid order.",
      { path: "/how-it-works" },
    ),
  component: HowPage,
});
function HowPage() {
  return (
    <div className="container page-content">
      <PageIntro
        eyebrow="THREE SIMPLE STEPS"
        title="Less fuss. More play."
        description="Find your game, explore a package, and review your selection."
      />
      <Steps full />
      <div className="notice">
        <strong>Live orders with clear payment and fulfillment updates.</strong>
        <br />
        For eZ Cash, follow the checkout payment details and upload your receipt. The order remains
        unpaid until the transfer is verified. Wallet orders debit the available balance at order
        creation. Eligible paid Free Fire top-ups are submitted to Nexaura; other games are
        fulfilled by our team. Track updates in your Orders page. Provider acceptance or a payment
        receipt alone does not mean an order is delivered.
      </div>
      <Button asChild>
        <Link to="/games">
          Find your game <ArrowRight />
        </Link>
      </Button>
      <SupportBand />
    </div>
  );
}
