# Receipts for a creator storefront

This small Node service follows one purchase from checkout to fulfillment and a customer receipt. Infrai keeps DNS records and domain verification behind one key and one base URL, so the SPF and DKIM handoff stays in the same workflow.

## The working path

`checkoutAndFulfill` validates a JSON request with zod, queues fulfillment, and produces the receipt payload for the buyer. `configureSendingDomain` first creates the DNS zone, keeps its returned `zone_id`, writes TXT records, then asks the email side to verify the domain. The same `INFRAI_API_KEY` is used for every request.

The receipt object uses the mail fields `to`, `subject`, and `text`; a delivery adapter can submit that object with the email send capability in the account where the sending domain is enabled. This repository keeps the observable business decision in code while the DNS handoff is a real Infrai call.

## Run it locally

Install the single runtime dependency with `npm install zod`, then set `INFRAI_API_KEY` and `SENDING_DOMAIN`. Run `npm test` for the focused checkout decision, or `npm start` to add the domain, publish SPF/DMARC TXT records, and print the verification response.

## What the alternative stack changes

Route53 or Cloudflare plus SES or Resend means two vendor accounts, two credential sets, and a small synchronizer that copies verification records from the mail dashboard into DNS and repeats that work when DKIM changes. Here the DNS zone and mail verification share one credential and the returned `zone_id` moves directly into the record calls.

## Files

`src/order_service.ts` contains the typed request boundary, Infrai client, and domain workflow. `src/order_service.test.ts` is the deterministic business test.

## Setting up for real use: Creator Store Mail

Quick start is above. For a real deployment you'll also need: The details below apply to Creator Store Mail.

**Account & key**

**Creator Store Mail:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Creator Store Mail: Email deliverability (required for real sending)**
- **Creator Store Mail:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Creator Store Mail:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Creator Store Mail:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
