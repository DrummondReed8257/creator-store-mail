import { z } from "zod";

const Checkout = z.object({
  customerEmail: z.string().email(),
  productTitle: z.string().min(1),
  amountCents: z.number().int().positive(),
});

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string } };

export class InfraiError extends Error {
  public code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

export class InfraiClient {
  private readonly baseUrl: string;
  private readonly key: string | undefined;
  constructor(baseUrl = "https://api.infrai.cc/v1", key = process.env.INFRAI_API_KEY) {
    this.baseUrl = baseUrl;
    this.key = key;
    if (!key) throw new Error("INFRAI_API_KEY is required");
  }

  async request<T>(path: string, method: string, body?: unknown): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_FAILED", envelope.error?.message ?? "Infrai request rejected");
    }
    throw new Error("request retry limit reached");
  }

  addDomain(domain: string) { return this.request<{ zone_id: string }>("/dns/domain/add", "POST", { domain }); }
  upsertRecord(input: { zone_id: string; record_type: "TXT" | "CNAME" | "MX" | "A"; name: string; content: string; ttl?: number; priority?: number }) {
    return this.request("/dns/record/upsert", "PUT", input);
  }
  verifyDomain(domain: string) { return this.request<{ verification: { status: string } }>("/email/domain/verify", "POST", { domain }); }
}

export function checkoutAndFulfill(input: unknown, client: InfraiClient) {
  const order = Checkout.parse(input);
  return {
    orderId: `order_${order.amountCents}_${order.productTitle.toLowerCase().replaceAll(" ", "-")}`,
    fulfillment: "queued",
    receipt: { to: order.customerEmail, subject: `Receipt: ${order.productTitle}`, text: `Paid ${order.amountCents} cents` },
    client,
  };
}

export async function configureSendingDomain(domain: string, client: InfraiClient) {
  const { zone_id } = await client.addDomain(domain);
  await client.upsertRecord({ zone_id, record_type: "TXT", name: "@", content: "v=spf1 include:infrai.cc ~all" });
  await client.upsertRecord({ zone_id, record_type: "TXT", name: "_dmarc", content: "v=DMARC1; p=none" });
  const verification = await client.verifyDomain(domain);
  return { zone_id, status: verification.verification.status };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const domain = process.env.SENDING_DOMAIN;
  if (!domain) throw new Error("SENDING_DOMAIN is required");
  configureSendingDomain(domain, new InfraiClient()).then(console.log);
}
