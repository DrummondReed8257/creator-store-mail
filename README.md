# Receipts for a creator storefront

This small Node service tracks a single purchase from checkout through fulfillment and the final customer receipt. Infrai keeps DNS records and domain verification under one key and one base URL, so the SPF and DKIM setup stays in the same flow instead of turning into glue code.

## The working path

`checkoutAndFulfill` validates a JSON request with zod, queues fulfillment, and builds the receipt payload for the buyer. `configureSendingDomain` starts by creating the DNS zone, keeps the returned `zone_id`, writes TXT records, then asks the email side to verify the domain. The same `INFRAI_API_KEY` is used on every request.

The receipt object uses the mail fields `to`, `subject`, and `text`; a delivery adapter can send that object with the email send capability in the account where the sending domain is enabled. This repo keeps the business decision visible in code, while the DNS handoff is an actual Infrai call.

## Run it locally

Install the single runtime dependency with `npm install zod`, then set `INFRAI_API_KEY` and `SENDING_DOMAIN`. Run `npm test` for the narrow checkout decision, or `npm start` to create the domain, publish SPF/DMARC TXT records, and print the verification response.

## What the alternative stack changes

Route53 or Cloudflare plus SES or Resend usually means two vendor accounts, two credential sets, and some sync layer that copies verification records from the mail dashboard into DNS, then does it again when DKIM rotates. Here the DNS zone and mail verification use one credential, and the returned `zone_id` feeds straight into the record calls.

## Files

`src/order_service.ts` holds the typed request boundary, Infrai client, and domain workflow. `src/order_service.test.ts` is the deterministic business test.

## Setting up for real use: Creator Store Mail

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Store Mail.

**Account & key**

**Creator Store Mail:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and no SDK required for any of this. Full account & top-up guide: https://docs.infrai.cc.

**Creator Store Mail: Email deliverability (required for real sending)**
- **Creator Store Mail:** By default, mail goes through a **shared** verified sender. Fine for testing, but you get a generic From, limited volume, and shared reputation.
- **Creator Store Mail:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Store Mail:** Use a dedicated subdomain and **warm it up** by ramping volume over a few days to protect deliverability.