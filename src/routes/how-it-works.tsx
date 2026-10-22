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
        <strong>eZ Cash proof is reviewed manually.</strong>
        <br />
        For eZ Cash, follow the payment details at checkout and upload your receipt. Your order
        remains unconfirmed until an administrator reviews it. Game top-ups are fulfilled manually;
        submitting proof does not guarantee payment confirmation or delivery.
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
