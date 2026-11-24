# Spec Delta

## ADDED Requirements

### Requirement: QR payment at checkout
A POS payment line MAY refer to a QR payment request. Checkout SHALL accept it only when the request is paid, for the same branch, method and amount, and not used by another sale; the payment SHALL carry the provider's transaction id and SHALL be written to the cash book account configured for that provider. A sale with a QR line whose request is not paid SHALL be refused.

#### Scenario: Paid by MoMo
- **WHEN** a 450,000 sale is paid by a MoMo QR request that is paid
- **THEN** the sale completes with a MoMo payment of 450,000 referencing MoMo's transaction id, recorded on the MoMo cash book account

#### Scenario: Not yet paid
- **WHEN** checkout includes a QR request that is still pending
- **THEN** checkout is refused with `QR_NOT_PAID`

#### Scenario: Reused request
- **WHEN** a paid request already used by one sale is sent with another sale
- **THEN** checkout is refused
