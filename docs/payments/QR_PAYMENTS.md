# Thanh toán QR (QR payments)

VietQR bank transfers and MoMo, ZaloPay, VNPay QR at the POS, confirmed before the sale completes.
Specs: `openspec/specs/payments/qr-payments`, `pos/checkout` (change `ewallet-qr-payments`).
Migration: `backend/prisma/migrations/028_qr_payments.sql` (rollback in `rollback/028_qr_payments.sql`).

## At the counter

1. In the payment sheet, set the row amount and press **QR**.
2. Choose the provider (only those enabled for the branch). The QR for that exact amount appears, with its code
   (`QR` + 8 characters) and a countdown (default 10 minutes).
3. The customer scans and pays:
   - **MoMo / ZaloPay / VNPay**: the provider calls the server; the dialog turns paid by itself (it checks every
     2 seconds). "Kiểm tra" asks MoMo/ZaloPay directly if a callback is late.
   - **VietQR**: the transfer description contains the code. When the money shows in the bank app, press
     **Đã nhận tiền** (needs `qr_payments:confirm`; your name is recorded). With a bank-notification webhook
     configured it confirms by itself.
4. The row becomes that payment method with the provider transaction id, locked. Complete the sale as usual.

A sale with a QR row that is not paid is refused (`QR_NOT_PAID`). A paid QR pays one sale only. Closing the
dialog while the QR is pending cancels it; a QR that expires cannot be used.

## Setup (Cài đặt → Thanh toán QR)

Per branch and provider: enable, fill the fields, choose the cash book account that receives the money
(default: the branch's mapping for that payment method), and register the callback URL shown on the card with
the provider.

| Provider | Fields | Callback |
| --- | --- | --- |
| VietQR | Bank BIN (e.g. 970436 Vietcombank), account number, account name; optional webhook secret | `POST /api/qr-payments/callbacks/bank/<storeId>` (bank-notification service) |
| MoMo | Partner code; access key, secret key | `POST /api/qr-payments/callbacks/momo` (IPN, answered 204) |
| ZaloPay | App ID; key1, key2 | `POST /api/qr-payments/callbacks/zalopay` |
| VNPay | TMN code; hash secret | `GET /api/qr-payments/callbacks/vnpay` (IPN) |

**Bank webhook format** (for VietQR auto-confirmation, e.g. a Casso/SePay-style service): JSON
`{ "id", "amount", "description" }` with header `X-Signature: hex(HMAC-SHA256(webhook secret, raw body))`. The
request is matched by its code in the description and the exact amount.

### Server configuration

- `QR_SECRETS_KEY`: 32 random bytes, base64 (`openssl rand -base64 32`). Secrets are encrypted with AES-256-GCM;
  without this key secrets cannot be saved. Keep it stable — changing it makes stored secrets unreadable.
- `PUBLIC_API_URL`: the public HTTPS base of the backend (e.g. `https://api.scmc.vn`), used for callback URLs.
- `PUBLIC_APP_URL`: where providers send the customer after paying (optional).
- The ingress must expose `/api/qr-payments/callbacks/*` publicly over HTTPS.

## Go-live checklist (per provider)

The adapters follow the providers' documented formats (MoMo v2 `captureWallet`, ZaloPay v2, VNPay 2.1.0) and
are tested against those signature formulas with a fake provider; they have **not** been run against the real
sandboxes from this environment. Before going live:

1. Enable the provider with **sandbox** on and sandbox credentials.
2. Create a QR for a small amount at the POS; pay it with the provider's test app.
3. Check the request turns paid, the sale completes, and the cash book entry lands on the right account.
4. Send the same callback again (provider dashboard "resend") — nothing changes, a second event is logged.
5. Switch sandbox off, enter production credentials, repeat with a real small payment.

For VietQR: create a QR, transfer from a banking app, confirm with "Đã nhận tiền"; if a webhook service is
used, check the request confirms by itself.

## Records

Every request, provider call, callback (with whether the signature was valid), manual confirmation, cancel and
expiry is stored in `qr_payment_events`. Secrets are never logged. A callback with a different amount marks the
request failed.

## Permissions

| Permission | Granted to |
| --- | --- |
| `qr_payments:create`, `qr_payments:confirm` | sales, sales_associate, store_manager, manager, superadmin |
| `qr_payments:configure` | manager, superadmin |

## Not covered

Card terminals, payment links for remote customers, refunds through providers (refunds go through returns and
the cash book).
