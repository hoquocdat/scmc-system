# Design

## Context

POS checkout takes all payments in one request (`PosCheckoutService` → `SalesPostingService.createOrderIn`), each payment written with one cash book receipt (account from the branch's method mapping). Payment methods: cash, card, bank_transfer, ewallet_momo/zalopay/vnpay, store_credit. Non-cash payments carry a typed reference. All controllers use `JwtAuthGuard` per controller, so a controller without it is public. Cash book accounts exist per branch (bank and e-wallet types).

## Goals / Non-Goals

**Goals:** VietQR for bank transfers with manual or webhook confirmation; MoMo, ZaloPay, VNPay QR through their APIs with verified callbacks and status checks; payment request states with expiry; a QR payment counts at checkout only when paid; provider settings per branch with encrypted secrets; full event log; idempotent callbacks.

**Non-Goals:** card terminals, payment links for remote customers, refunds through providers.

## Decisions

### D1. Data model (migration 028)

- `qr_provider_settings`: `store_id`, `provider` (`vietqr | momo | zalopay | vnpay`), `is_enabled`, `config` jsonb (non-secret: bank BIN, account number and name; partner code / app id / TMN code; sandbox flag; expiry minutes), `secrets` text (AES-256-GCM, key from `QR_SECRETS_KEY`), `cash_account_id` (bank/e-wallet account receiving the money); unique (store, provider).
- `qr_payment_requests`: `code` (unique, `QR` + 8 chars, used as provider order id and transfer description), `store_id`, `pos_session_id`, `provider`, `method` (`bank_transfer | ewallet_momo | ewallet_zalopay | ewallet_vnpay`), `amount`, `status` (`pending | paid | failed | expired | cancelled`), `qr_content`, `pay_url`, `provider_ref` (provider transaction id), `client_request_id` (cart), `sales_order_id`, `sales_order_payment_id`, `expires_at`, `paid_at`, `confirmed_by` (manual), `failure_reason`, `created_by`, timestamps.
- `qr_payment_events`: `request_id` (nullable for unmatched callbacks), `provider`, `kind` (`create | callback | query | manual_confirm | webhook | cancel`), `signature_ok`, `payload` jsonb, `created_at`.
- `sales_order_payments.qr_payment_request_id` (unique).
- Permissions `qr_payments:create|confirm|configure`; create and confirm: sales, sales_associate, store_manager, manager, superadmin; configure: manager, superadmin.

### D2. Provider interface

`QrProvider.create(request, settings) → { qr_content, pay_url, provider_ref? }`, `verifyCallback(payload, headers, settings) → { code, paid, provider_ref, amount, signatureOk }`, `query(request, settings) → status`. Adapters:
- **VietQR** (local): EMVCo merchant-presented QR per NAPAS 247 (`00` format, `01` dynamic, `38` with GUID `A000000727`, bank BIN and account, service `QRIBFTTA`, `53` = 704, `54` amount, `58` VN, `62/08` description = request code, `63` CRC-16/CCITT-FALSE). No API call. Confirmed manually or by the bank webhook.
- **MoMo** v2 `captureWallet`: HMAC-SHA256 over the documented `accessKey=…&amount=…&…` string; IPN verified the same way; query API as fallback.
- **ZaloPay** v2: `mac = HMAC-SHA256(key1, app_id|app_trans_id|app_user|amount|app_time|embed_data|item)`; callback `mac = HMAC-SHA256(key2, data)`; query with `HMAC(key1, app_id|app_trans_id|key1)`.
- **VNPay** 2.1.0: payment URL with `vnp_SecureHash = HMAC-SHA512(secret, sorted encoded query)`; IPN verified the same way, answered `{RspCode, Message}`.
- **Bank webhook** (VietQR auto-confirm): generic JSON `{ id, amount, description, transferred_at }` signed with `X-Signature: HMAC-SHA256(secret, body)`; matched by the request code in the description and the exact amount. Fits Casso/SePay-style services; the exact service is configured later.

HTTP calls use `fetch` with a 10 s timeout; every request and response is logged as an event (secrets never logged).

### D3. States and timeouts

`pending → paid | failed | expired | cancelled`, no other transitions. Expiry default 10 minutes (setting). Reading or polling a pending request past its expiry first asks the provider (if it has a query API) and then marks it expired. A duplicate or late callback is logged and changes nothing. A callback whose amount differs from the request is logged and marks it failed.

### D4. Checkout

A payment line may carry `qr_payment_request_id`. In the checkout transaction the request row is locked and must be `paid`, same branch, same method, the same amount as the line, and not yet used; it is then linked to the order and payment. The payment's reference is the provider transaction id and its cash book entry goes to the settings' account (explicit account on the posting). Without a paid request, a QR line is refused (`QR_NOT_PAID`), so a pending QR blocks completing the sale. A request is tied to the cart (`client_request_id`) to stop it being reused for another sale.

### D5. Manual confirmation

For VietQR, staff with `qr_payments:confirm` press "Đã nhận tiền" after seeing the transfer in the bank app; the event log records who. Providers with callbacks are not confirmed manually (only "Kiểm tra" which queries the provider).

### D6. Settings and secrets

`/settings/qr-payments`: per branch, enable providers and fill their fields; secrets are write-only (shown masked), encrypted with AES-256-GCM; `QR_SECRETS_KEY` (32 bytes, base64) must be set or saving secrets is refused. Callback URLs to register with each provider are shown on the page (`PUBLIC_API_URL` + `/api/qr-payments/callbacks/<provider>`).

### D7. Frontend

POS payment sheet: "QR" button per row opens a dialog: choose an enabled provider, create the request for the row amount, show the QR (rendered client-side with `qrcode`), poll status every 2 s (TanStack Query `refetchInterval`), countdown to expiry, "Kiểm tra", "Đã nhận tiền" (VietQR, with permission), "Hủy". When paid, the row becomes that method with the reference and request id, locked.

## Risks / Trade-offs

- **Provider formats cannot be exercised here**; adapters are unit-tested against the documented signature formulas and a fake provider. Each provider must be checked in its sandbox before go-live.
- **Public callbacks**: protected by signatures, rate limits from the ingress, and idempotent transitions.
- **Manual VietQR confirmation relies on staff**; the bank webhook removes it once a service is chosen.

## Migration Plan

Apply 028; set `QR_SECRETS_KEY` and `PUBLIC_API_URL`; expose `/api/qr-payments/callbacks/*` through the ingress; configure providers per branch. Nothing changes until a provider is enabled.

## Open Questions

Which bank-notification service SCMC uses for automatic VietQR confirmation (the generic webhook fits Casso/SePay-style services).
