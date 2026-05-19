import { createReturn, getOrder } from "@/lib/api";
import type { Order, Return } from "@/lib/types";
import { sleep, createWebhook } from "workflow";

const CONSOLATION_DELAY = "30s"; // production: "2d"

type ReturnCallback = {
    decision: "approved" | "rejected";
};

async function sendConsolationPromo(orderId: string, decision: ReturnCallback): Promise<void> {
    "use step";

    const verdict = decision.decision === "approved" ? "approved" : "rejected";
    if (verdict === "approved") {
        console.log(
            `[returnFlow] 📧 sorry order ${orderId} didn't work out — here's COMEBACK10 for 10% off your next order.`,
        );
    } else {
        console.log(
            `[returnFlow] return for order ${orderId} was rejected — skipping consolation promo.`,
        );
    }
}

export async function returnFlow(orderId: string, reason: string) {
    "use workflow";

    const callbackHook = createWebhook();

    const order = await fetchOrder(orderId);

    // Returns immediately with a pending state
    const filed = await submitReturn(order, reason, callbackHook.url);

    // We're firing the return off and walking away. We don't yet know
    // whether it gets approved or rejected - we'll wire that up later.
    console.log(`[returnFlow] filed return ${filed.id} for order ${filed.orderId} — status: ${filed.status}`);

    // Suspend until this webhook called
    const request = await callbackHook;
    const decision: ReturnCallback = await request.json();

    await sleep(CONSOLATION_DELAY);
    await sendConsolationPromo(orderId, decision);

    return { orderId, returnId: filed.id, consolationSent: true };
}

async function fetchOrder(orderId: string): Promise<Order> {
    "use step";
    return getOrder(orderId);
}

async function submitReturn(order: Order, reason: string, callback: string): Promise<Return> {
    "use step";
    return createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
        })),
        reason,
        callback
    });
}