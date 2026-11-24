# Spec Delta

## Purpose

Tells each branch which items are running low and how many to reorder, and starts the purchase order.

## ADDED Requirements

### Requirement: Low stock
An item SHALL be low at a location when its available stock (on hand minus reserved) is at or below its threshold, the larger of the product's reorder point and the location's safety stock, and the threshold is above zero. The suggested quantity SHALL be the product's reorder quantity, or twice the threshold minus available stock when none is set.

#### Scenario: Helmets low
- **WHEN** helmets have reorder point 5, reorder quantity 20 and HCMC has 4 available
- **THEN** HCMC lists helmets as low with a suggested quantity of 20

### Requirement: Alerts on screen and to purchase
Low items SHALL be shown on the dashboard as a count per branch and as a list, and staff SHALL be able to create a draft purchase order from selected low items for a supplier.

#### Scenario: Draft PO
- **WHEN** a manager selects helmets and gloves from the list and supplier "Momotaro"
- **THEN** a draft purchase order for those items at their suggested quantities is created
