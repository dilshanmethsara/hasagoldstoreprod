/**
 * Trusted server-side order creation — TanStack Start server function.
 *
 * Lives outside `src/server/` (which is blocked by import-protection) so the
 * TanStack Start bundler can expose an RPC bridge for the client to call.
 * The Admin SDK imports happen at *server execution time* only — the handler
 * runs exclusively on the server and the Admin credentials are never sent to
 * the browser.
 *
 * Flow:
 *   1. Client calls createOrder({ data: { idToken, productId, playerId, server } })
 *   2. Server verifies the Firebase ID token (real identity, not forgeable).
 *   3. Server reads the product from Firestore (trusted price snapshot).
 *   4. Server creates the order using the selected payment flow. Wallet orders
 *      atomically deduct the live price; eZ Cash orders remain unpaid until review.
 *   5. Returns the new order id and price snapshot to the client.
 *
 * Clients can NEVER:
 *   - Supply a price (it is read from Firestore, not from the request).
 *   - Bypass the atomic wallet balance check.
 *   - Fulfill a game top-up (delivery remains a separate manual operation).
 *   - Write to Firestore directly (security rules deny all client order writes).
 */
import { createServerFn } from "@tanstack/react-start";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/firestore-schema";
import { parsePaymentMethods } from "@/lib/payment-methods";

export interface CreateOrderInput {
  idToken: string;
  productId: string;
  playerId: string;
  server: string;
  paymentMethod: PaymentMethod;
}

export interface CreatedOrder {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  gameSlug: string;
  gameName: string;
  packageName: string;
  amount: number;
  unitLabel: string;
  priceUsd: number;
  pricePkr: number;
  currency: string;
  playerId: string;
  playerName: string | null;
  playerNameLookupStatus: "verified" | "unavailable" | "not_supported";
  playerRegion: string | null;
  playerNameSource: "live" | "saved" | null;
  server: string;
  paymentMethod: PaymentMethod;
  paymentRecipient: string | null;
  emailNotificationSent: boolean;
  nexauraSubmission?: { status: string; orderId?: string; message?: string };
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown): CreateOrderInput => {
    const input = raw as Partial<CreateOrderInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid order request.");
    if (typeof input.idToken !== "string" || !input.idToken)
      throw new Error("Missing authentication token.");
    if (typeof input.productId !== "string" || !input.productId)
      throw new Error("Missing product.");
    if (
      typeof input.playerId !== "string" ||
      !input.playerId.trim() ||
      input.playerId.trim().length > 128
    ) {
      throw new Error("Enter a valid Player ID (up to 128 characters).");
    }
    if (typeof input.server !== "string" || input.server.trim().length > 100)
      throw new Error("Invalid game server.");
    const paymentMethods: PaymentMethod[] = ["wallet", "ezcash"];
    if (!paymentMethods.includes(input.paymentMethod as PaymentMethod)) {
      throw new Error("Choose a supported payment method.");
    }
    return {
      idToken: input.idToken,
      productId: input.productId,
      playerId: input.playerId.trim(),
      server: input.server,
      paymentMethod: input.paymentMethod as PaymentMethod,
    };
  })
  .handler(async ({ data }): Promise<CreatedOrder> => {
    // Dynamic imports keep Admin SDK out of the client bundle entirely.
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");

    // 1. Verify caller identity.
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;
    const email = typeof decoded.email === "string" ? decoded.email : "";

    // 2. Read product (trusted price source).
    const db = getAdminDb();
    const storeSettings = await db.doc("settings/store").get();
    if (storeSettings.data()?.["maintenanceMode"] === true) {
      throw new Error("The store is in maintenance mode. Please try again later.");
    }
    const productSnap = await db.doc(`products/${data.productId}`).get();
    if (!productSnap.exists) throw new Error("This product is no longer available.");
    const product = productSnap.data();
    if (
      product?.["active"] !== true ||
      typeof product["gameSlug"] !== "string" ||
      typeof product["amount"] !== "number" ||
      !Number.isFinite(product["amount"]) ||
      typeof product["unitLabel"] !== "string" ||
      typeof product["priceUsd"] !== "number" ||
      !Number.isFinite(product["priceUsd"]) ||
      typeof product["pricePkr"] !== "number" ||
      !Number.isFinite(product["pricePkr"]) ||
      product["priceUsd"] < 0 ||
      product["pricePkr"] < 0
    )
      throw new Error("This product is no longer available.");

    // 3. Read game for snapshot.
    const gameSnap = await db.doc(`games/${product["gameSlug"]}`).get();
    if (!gameSnap.exists || gameSnap.data()?.["active"] !== true)
      throw new Error("This game is no longer available.");
    if (product["gameSlug"] === "free-fire" && !/^\d{6,15}$/.test(data.playerId)) {
      throw new Error("Enter a Free Fire Player ID containing 6 to 15 digits.");
    }
    const gameName = gameSnap.data()?.["name"];
    if (typeof gameName !== "string" || !gameName.trim())
      throw new Error("This game is no longer available.");
    const amount = product["amount"];
    const unitLabel = product["unitLabel"];
    const priceUsd = product["priceUsd"];
    const pricePkr = product["pricePkr"];
    const gameSlug = product["gameSlug"];
    const nexauraProductId =
      gameSlug === "free-fire" && typeof product["nexauraProductId"] === "string"
        ? product["nexauraProductId"].trim()
        : "";
    if (gameSlug === "free-fire" && !nexauraProductId) {
      throw new Error("This Free Fire package is not configured for automatic top-up yet.");
    }
    if (gameSlug === "free-fire" && !process.env["NEXAURA_API_KEY"]?.trim()) {
      throw new Error("Free Fire automatic top-up is not configured on the server.");
    }
    const configuredPackageName = product["name"];
    const packageName =
      typeof configuredPackageName === "string" && configuredPackageName.trim()
        ? configuredPackageName.trim()
        : `${amount.toLocaleString()} ${unitLabel}`;
    const settings = storeSettings.data();

    const configuredMethods = parsePaymentMethods(settings?.["paymentMethods"]);
    if (!configuredMethods.some((method) => method.id === data.paymentMethod && method.active)) {
      throw new Error("Selected payment method is not available. Choose another method.");
    }

    const paymentRecipient =
      data.paymentMethod === "ezcash" &&
      typeof settings?.["paymentEzcashNumber"] === "string" &&
      typeof settings?.["paymentEzcashName"] === "string" &&
      settings["paymentEzcashNumber"].trim() &&
      settings["paymentEzcashName"].trim()
        ? `${settings["paymentEzcashNumber"].trim()} — ${settings["paymentEzcashName"].trim()}`
        : null;
    if (data.paymentMethod === "ezcash" && !paymentRecipient) {
      throw new Error("eZ Cash payment details are not configured. Please contact the store.");
    }

    // 4. Create the order with server-calculated price and payment status.
    const orderRef = db.collection("orders").doc();
    const orderRecord = {
      customerUid: uid,
      customerEmail: email,
      gameSlug,
      gameName,
      productId: data.productId,
      ...(gameSlug === "free-fire" ? { nexauraProductId } : {}),
      packageName,
      amount,
      unitLabel,
      priceUsd,
      pricePkr,
      currency: "LKR",
      playerId: data.playerId,
      playerName: null,
      playerNameLookupStatus: "not_supported",
      playerRegion: null,
      playerNameSource: null,
      server: data.server,
      paymentMethod: data.paymentMethod,
      paymentRecipient,
      status: (data.paymentMethod === "wallet" ? "processing" : "pending") satisfies OrderStatus,
      paymentStatus: (data.paymentMethod === "wallet" ? "paid" : "unpaid") satisfies PaymentStatus,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (data.paymentMethod === "wallet") {
      const userRef = db.doc(`users/${uid}`);
      await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) throw new Error("Your account profile could not be found.");
        const walletBalance = userSnapshot.data()?.["walletBalanceLkr"];
        if (
          typeof walletBalance !== "number" ||
          !Number.isFinite(walletBalance) ||
          walletBalance < pricePkr
        ) {
          throw new Error("Your wallet balance is too low for this order.");
        }
        transaction.update(userRef, {
          walletBalanceLkr: walletBalance - pricePkr,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(orderRef, orderRecord);
      });
    } else {
      await orderRef.set(orderRecord);
    }

    let nexauraSubmission: { status: string; message?: string } | undefined;
    if (gameSlug === "free-fire" && data.paymentMethod === "wallet") {
      try {
        const { submitFreeFireTopup } = await import("@/server/nexaura-topups");
        nexauraSubmission = await submitFreeFireTopup(orderRef.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Nexaura submission could not be confirmed.";
        console.error("Wallet order was paid, but Nexaura submission needs review:", {
          orderId: orderRef.id,
          error,
        });
        nexauraSubmission = { status: "submission_unknown", message };
      }
    }

    let emailNotificationSent = false;
    try {
      const { sendOrderConfirmationEmail } = await import("@/server/resend-email");
      await sendOrderConfirmationEmail({
        to: email,
        orderId: orderRef.id,
        gameName,
        packageName,
        playerId: data.playerId,
        server: data.server,
        totalLkr: pricePkr,
        paymentMethod: data.paymentMethod,
      });
      emailNotificationSent = true;
    } catch (error) {
      console.error("Order was created, but its confirmation email could not be sent:", {
        orderId: orderRef.id,
        error,
      });
    }

    return {
      orderId: orderRef.id,
      status: data.paymentMethod === "wallet" ? "processing" : "pending",
      paymentStatus: data.paymentMethod === "wallet" ? "paid" : "unpaid",
      gameSlug,
      gameName,
      packageName,
      amount,
      unitLabel,
      priceUsd,
      pricePkr,
      currency: "LKR",
      playerId: data.playerId,
      playerName: null,
      playerNameLookupStatus: "not_supported",
      playerRegion: null,
      playerNameSource: null,
      server: data.server,
      paymentMethod: data.paymentMethod,
      paymentRecipient,
      emailNotificationSent,
      // exactOptionalPropertyTypes: omit the key instead of passing undefined.
      ...(nexauraSubmission ? { nexauraSubmission } : {}),
    };
  });

export const submitOrderPaymentProof = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown; fileName?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in before submitting payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    if (
      typeof input.fileName !== "string" ||
      !input.fileName.trim() ||
      input.fileName.length > 200
    ) {
      throw new Error("Choose a valid payment proof image.");
    }
    return {
      idToken: input.idToken,
      orderId: input.orderId,
      fileName: input.fileName.replace(/[\\/]/g, "_").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;
    const orderRef = getAdminDb().doc(`orders/${data.orderId}`);
    const order = await orderRef.get();
    const orderData = order.data();
    if (!order.exists || orderData?.["customerUid"] !== uid)
      throw new Error("This order was not found in your account.");
    if (orderData["paymentMethod"] !== "ezcash")
      throw new Error("Payment proof upload is available only for eZ Cash orders.");
    if (!["unpaid", "failed", "proof_rejected"].includes(String(orderData["paymentStatus"]))) {
      throw new Error("This order is no longer accepting payment proof.");
    }
    const storagePath = `${uid}/${data.orderId}/proof`;
    const { validateUploadedProof } = await import("@/server/supabase-storage");
    const contentType = await validateUploadedProof(storagePath);
    await orderRef.update({
      paymentStatus: "proof_submitted" satisfies PaymentStatus,
      status: "payment_review" satisfies OrderStatus,
      paymentProofStoragePath: storagePath,
      paymentProofStorageProvider: "supabase",
      paymentProofContentType: contentType,
      paymentProofFileName: data.fileName,
      paymentProofSubmittedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { orderId: data.orderId, status: "payment_review", paymentStatus: "proof_submitted" };
  });

export const getOrderPaymentProofUploadToken = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in before uploading payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;
    const order = await getAdminDb().doc(`orders/${data.orderId}`).get();
    const record = order.data();
    if (!order.exists || !record || record["customerUid"] !== uid)
      throw new Error("This order was not found in your account.");
    if (record["paymentMethod"] !== "ezcash")
      throw new Error("Payment proof upload is available only for eZ Cash orders.");
    if (!["unpaid", "failed", "proof_rejected"].includes(String(record["paymentStatus"]))) {
      throw new Error("This order is no longer accepting payment proof.");
    }
    const path = `${uid}/${data.orderId}/proof`;
    const { createProofUploadToken } = await import("@/server/supabase-storage");
    const { signedUrl, token } = await createProofUploadToken(path);
    return { path, signedUrl, token };
  });

export const getOrderPaymentProofUrl = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in to view your payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    const {
      assertCustomerProfileComplete,
      assertEmailVerified,
      getAdminAuth,
      getAdminDb,
      getAdminStorage,
    } = await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;
    const order = await getAdminDb().doc(`orders/${data.orderId}`).get();
    const record = order.data();
    if (!order.exists || !record || record["customerUid"] !== uid)
      throw new Error("This order was not found in your account.");
    const path = record["paymentProofStoragePath"];
    if (typeof path !== "string") throw new Error("No payment proof has been submitted.");
    if (record["paymentProofStorageProvider"] === "supabase") {
      if (path !== `${uid}/${data.orderId}/proof`)
        throw new Error("This order has no valid payment proof.");
      const { createProofViewUrl } = await import("@/server/supabase-storage");
      return { url: await createProofViewUrl(path) };
    }
    const legacyPath = `payment-proofs/${uid}/${data.orderId}/proof`;
    if (path !== legacyPath) throw new Error("This order has no valid payment proof.");
    const [url] = await getAdminStorage()
      .bucket()
      .file(legacyPath)
      .getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000 });
    return { url };
  });
