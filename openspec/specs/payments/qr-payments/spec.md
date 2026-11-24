# payments/qr-payments Specification

## Purpose

Lets customers pay at the counter by scanning a QR code for the exact amount, by bank transfer (VietQR) or e-wallet (MoMo, ZaloPay, VNPay), with the payment confirmed before the sale completes.

## Requirements

### Requirement: QR payment requests
Staff SHALL create a QR payment request for an amount, a branch and an enabled provider. A request SHALL have a unique code and the states pending, paid, failed, expired and cancelled, and SHALL only move from pending to one of the others.

#### Scenario: VietQR for a bank transfer
- **WHEN** a cashier requests VietQR for 1,250,000 at HCMC
- **THEN** a VietQR code for the HCMC bank account with amount 1,250,000 and the request code in the description is shown

#### Scenario: Expired
- **WHEN** a request is still pending 10 minutes after creation
- **THEN** it becomes expired and cannot be used for a sale

### Requirement: Provider callbacks
Callbacks from MoMo, ZaloPay, VNPay and the bank-notification webhook SHALL be accepted only with a valid signature, SHALL mark the request paid with the provider's transaction id when the amount matches, and SHALL change nothing when received again. Every callback and provider call SHALL be logged.

#### Scenario: Valid MoMo IPN
- **WHEN** MoMo sends a successful IPN with a valid signature for a pending request
- **THEN** the request is paid with MoMo's transaction id

#### Scenario: Bad signature
- **WHEN** a callback arrives with a wrong signature
- **THEN** it is logged as invalid and the request is unchanged

#### Scenario: Duplicate
- **WHEN** the same successful callback arrives twice
- **THEN** the request is paid once and the second callback is only logged

### Requirement: Manual confirmation and status checks
Staff with `qr_payments:confirm` SHALL be able to confirm a VietQR payment they have seen arrive, recorded with their name. For providers with a query API, staff SHALL be able to check the status, which updates the request.

#### Scenario: Cashier confirms a transfer
- **WHEN** the cashier sees 1,250,000 arrive in the bank app and confirms
- **THEN** the request is paid and records the cashier as confirmer

### Requirement: Provider settings
Admins with `qr_payments:configure` SHALL enable providers per branch with their account details and the cash book account that receives the money. Secrets SHALL be stored encrypted and never returned.

#### Scenario: Secrets hidden
- **WHEN** a manager opens the MoMo settings of HCMC
- **THEN** the secret key is shown masked
