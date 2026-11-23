# Proposal

## Why

Vietnamese customers commonly pay by QR code. After `pos-checkout-core`, e-wallet and bank-transfer payments are recorded by hand: the cashier checks the customer's phone or the bank app and types a reference. That is slow and easy to get wrong. Generating a QR code for the exact amount and confirming payment automatically makes checkout faster and removes manual matching.

## What Changes

- Bank transfer by VietQR: the POS shows a VietQR code for the branch's bank account with the exact amount and the order number in the transfer description.
- E-wallet QR through payment providers (MoMo, ZaloPay, VNPay): create a payment request, show the QR, and receive the result by the provider's callback (IPN), with status checks as a fallback.
- Payment states: pending, paid, failed, expired, cancelled; a pending QR payment blocks completing the sale until it is paid or cancelled; timeouts are handled.
- Confirmed QR payments are recorded as sale payments with the provider's transaction ID, and written to the cash book account for that bank or e-wallet.
- Provider settings per branch (credentials, account, enabled methods), stored securely and managed only by admins.
- Confirming VietQR transfers: manual confirmation by staff by default; automatic matching through a bank or payment-gateway webhook is decided in design, depending on which service SCMC uses.
- Callbacks are verified (signature) and processed once even if received more than once; all provider calls are logged.

## Capabilities

### New Capabilities
- `payments/qr-payments`: Generating QR payment requests, receiving and verifying provider callbacks, payment states and timeouts, and provider configuration.

### Modified Capabilities
- `pos/checkout` (introduced by `pos-checkout-core`): adds QR payment as a payment method that must be confirmed before the sale completes.

## Impact

- **Backend**: new `src/qr-payments` module with a provider interface and adapters (VietQR, MoMo, ZaloPay, VNPay); public callback endpoints (outside JWT auth, protected by signature checks); secrets in configuration.
- **Database**: raw SQL migration for payment requests, provider settings and callback log.
- **Frontend**: QR payment dialog in POS that waits for the result (polling via TanStack Query); provider settings page.
- **Infrastructure**: the backend must be reachable from the internet over HTTPS for provider callbacks (Helm ingress).
- **External**: merchant accounts with each provider SCMC chooses to use.
- **Depends on**: `pos-checkout-core`, `cash-book`.

## Out of Scope

- Card terminal integration (card payments stay manually recorded).
- Online payment links for e-commerce or remote customers.
- Refunds through the provider's API (refunds go through `sales-returns` and the cash book).
