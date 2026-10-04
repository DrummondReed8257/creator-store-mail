import { checkoutAndFulfill } from "./order_service.ts";

const result = checkoutAndFulfill({ customerEmail: "buyer@example.com", productTitle: "Video pack", amountCents: 2400 }, {} as never);
if (result.fulfillment !== "queued" || result.receipt.to !== "buyer@example.com") throw new Error("checkout decision failed");
console.log("checkout test passed");
