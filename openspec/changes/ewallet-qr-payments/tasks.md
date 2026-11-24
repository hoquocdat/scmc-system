# Tasks

## 1. Database and security

- [ ] 1.1 Write `backend/prisma/migrations/028_qr_payments.sql` (D1) and rollback; apply up/down/up; pull and generate; build
- [ ] 1.2 Secret encryption (AES-256-GCM, `QR_SECRETS_KEY`) with unit tests; masked reads

## 2. Providers

- [ ] 2.1 VietQR EMV payload builder with CRC-16/CCITT-FALSE; unit tests against a known payload
- [ ] 2.2 MoMo, ZaloPay, VNPay adapters (create, verify callback, query) and the bank webhook verifier; unit tests of the signature formulas and of rejection on a wrong signature
- [ ] 2.3 Provider calls with timeout and event logging (no secrets in logs)

## 3. Service and API

- [ ] 3.1 Requests: create, get with expiry handling, status check, manual confirm, cancel (D3, D5); integration tests for expiry, manual confirm and permissions
- [ ] 3.2 Public callback endpoints with signature checks, idempotent transitions, amount check (D2, D3); integration tests for valid, invalid and duplicate callbacks with a fake provider
- [ ] 3.3 Checkout with `qr_payment_request_id` (D4): locked check, link, provider reference, explicit cash book account; integration tests for paid, pending (`QR_NOT_PAID`) and reused
- [ ] 3.4 Settings API per branch with encrypted secrets and callback URLs (D6)

## 4. Frontend

- [ ] 4.1 API client; QR dialog in the POS payment sheet with polling, countdown, check, confirm, cancel (D7)
- [ ] 4.2 `/settings/qr-payments` per branch and provider; navigation gated by `qr_payments:configure`

## 5. Checks

- [ ] 5.1 All suites, both builds, lint on new files
- [ ] 5.2 `docs/payments/QR_PAYMENTS.md` (setup per provider, callback URLs, go-live checklist with sandbox tests)
