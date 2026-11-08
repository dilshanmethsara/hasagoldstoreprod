export interface NexauraSubmissionResult {
  status: string;
  orderId?: string;
  duplicate?: boolean;
  message?: string;
}

export interface NexauraPollResult {
  orderId: string;
  status: string;
  note: string | null;
  issueType?: "stock_issue" | "system_issue" | null;
  terminal: boolean;
}

export async function submitFreeFireTopup(): Promise<NexauraSubmissionResult> {
  throw new Error("Free Fire top-up submissions are handled by the secure Neon-backed API layer.");
}

export async function pollFreeFireTopupStatus(): Promise<NexauraPollResult> {
  throw new Error(
    "Free Fire top-up status polling is handled by the secure Neon-backed API layer.",
  );
}
