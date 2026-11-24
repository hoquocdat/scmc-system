# Spec Delta

## Purpose

Voucher codes customers can present for a discount, with limits SCMC controls and usage it can count.

## ADDED Requirements

### Requirement: Voucher campaigns and codes
The system SHALL keep voucher campaigns with a value (percent with an optional maximum, or a fixed amount), a minimum order, validity dates, branch and channel limits, uses per code, uses per customer and whether the voucher combines with promotions. Codes SHALL be created singly or in batches with a prefix, be unique, and be case-insensitive.

#### Scenario: Batch
- **WHEN** a manager generates 200 codes with prefix "TET27" for campaign "Tết 2027 −10%"
- **THEN** 200 distinct codes starting with "TET27" are listed with 0 uses

### Requirement: Voucher validation
A voucher SHALL be accepted only if the code and campaign are active, the sale is inside the dates, branch and channel match, the order after promotions and manual discount meets the minimum, the code and the customer are within their use limits, and it may combine with the promotions applied. A rejected code SHALL say why.

#### Scenario: Minimum not met
- **WHEN** a code with a 1,000,000 minimum is entered on a 800,000 cart
- **THEN** it is rejected with "Đơn tối thiểu 1.000.000 đ"

#### Scenario: Already used
- **WHEN** a single-use code is entered a second time
- **THEN** it is rejected as already used

#### Scenario: Not with promotions
- **WHEN** a campaign does not combine with promotions and the cart has a promotion
- **THEN** the code is rejected with that reason

### Requirement: Voucher value
A percent voucher SHALL take the percent of the amount after promotions and manual order discount, capped by its maximum; a fixed voucher SHALL take its amount; neither SHALL exceed that amount. One voucher SHALL apply per order, before loyalty redemption.

#### Scenario: Capped percent
- **WHEN** a 10% voucher capped at 200,000 is used on a 3,000,000 cart
- **THEN** the voucher gives 200,000 off

### Requirement: Redemption and release
Using a voucher SHALL be recorded with the order in the same transaction, counting against its limits even when two counters use it at the same moment. Cancelling the order SHALL release the use; returns SHALL NOT.

#### Scenario: Two counters, one single-use code
- **WHEN** two checkouts use the same single-use code at the same time
- **THEN** one succeeds and the other is refused as already used

#### Scenario: Cancelled order
- **WHEN** a back-office order that used a single-use code is cancelled
- **THEN** the code can be used again

### Requirement: Voucher management
Staff with `vouchers:create|update|delete` SHALL manage campaigns and codes; `vouchers:read` SHALL show campaigns with codes, uses and total discount, and allow exporting codes.

#### Scenario: Usage
- **WHEN** a manager opens a campaign
- **THEN** it shows codes generated, codes used and the total discount given
