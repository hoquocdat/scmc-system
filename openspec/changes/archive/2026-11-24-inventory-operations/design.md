# Design

## Context

Stock lives in `inventory` (one row per location and product or variant — exactly one of the two is set, partial unique indexes per location). `inventory_transactions` rows move it through the `update_inventory_from_transaction` trigger: `RECEIVE | ADJUST | RETURN | TRANSFER_IN` add the quantity, `SALE | TRANSFER_OUT` subtract it, other types are recorded without moving stock (purchase-order approval and returns already use this). The trigger only updates existing rows, and `quantity_on_hand >= 0` is enforced. Sales posting deducts stock when an order becomes confirmed/completed, after locking the rows. `quantity_reserved`, `reorder_point`/`reorder_quantity` (products) and `safety_stock` (inventory) exist but nothing uses them. `transfer_orders`/`transfer_order_items` exist (number column without default, status default `pending`, from ≠ to) with no module. Permissions `inventory:read|adjust|transfer` exist. Each store has one selling location (`stores.default_warehouse_id`); other locations (warehouse, workshop) are plain `stock_locations`. Documents use `next_document_number(type, period)`.

## Goals / Non-Goals

**Goals:** transfers with ship/receive and discrepancies; stock counts with a defined rule for sales during the count; write-offs; barcodes with scanning and labels; reorder alerts with a purchase order shortcut; reservations by pending orders and available stock; selling and buying units.

**Non-Goals:** serial/lot/expiry, bins, automatic purchase orders, multi-level unit trees (one base unit plus conversion units only).

## Decisions

### D1. Data model (migration 027)

- `transfer_orders`: add `cancelled_at`, `cancelled_by`, `cancel_reason`; status values `pending | in_transit | partially_received | received | cancelled` (check constraint); numbers `CK-YYMM-#####`. `transfer_order_items`: add `quantity_discrepancy` (shipped − received when closed), `unit_cost`.
- `stock_counts` (`count_number` `KK-YYMM-#####`, `location_id`, `status` `counting | completed | cancelled`, `scope` jsonb, `note`, `created_by/at`, `completed_by/at`) and `stock_count_items` (`product_id` xor `product_variant_id`, `system_quantity` at start, `counted_quantity`, `system_at_count`, `counted_at`, `counted_by`, `adjustment`).
- `stock_write_offs` (`write_off_number` `XH-YYMM-#####`, `location_id`, `reason` `damaged | lost | internal_use | expired | other`, `note`, `total_cost`, `created_by/at`) and `stock_write_off_items` (product xor variant, `quantity`, `unit_cost`).
- `products.barcode`, `product_variants.barcode` (unique where not null, across both tables by a trigger-free check in the service plus partial unique indexes per table); `products.base_unit` (default `cái`).
- `product_units` (`product_id`, `name`, `factor` int > 1, `barcode` unique, `price` optional, `is_active`); `sales_order_items.unit_name`, `unit_factor` (default 1); `purchase_order_items.unit_name`, `unit_factor` (default 1).
- Trigger update: `WRITE_OFF` subtracts; `TRANSFER_LOSS`, `RETURN_DAMAGED`, `COUNT_NOTE` are recorded only.
- Permissions: `inventory:write_off`, `inventory:count`, `inventory:approve_count`, `inventory:labels`. Grants: manager, superadmin, store_manager all; warehouse_staff `count`, `transfer`, `labels`; `inventory:transfer` granted to store_manager and warehouse_staff if missing.

### D2. Transfers

- **Create** (`pending`): from, to, lines with requested quantities. Editable and cancellable while pending.
- **Ship** (`pending → in_transit`): shipped quantity per line (default requested, may be less). Source rows locked; shipped ≤ available (on hand − reserved) or the ship is refused listing shortages. One `TRANSFER_OUT` per line at the product's current cost.
- **Receive** (`in_transit | partially_received → partially_received | received`): received quantities per line, cumulative ≤ shipped; `TRANSFER_IN` at the destination (row created at 0 if missing). `close = true` (or everything received) ends the transfer: unreceived units become `quantity_discrepancy` and a `TRANSFER_LOSS` record (stock already left the source).
- **Cancel**: pending → cancelled; in transit → cancelled with the shipped-but-unreceived units returned to the source (`TRANSFER_IN` there).
- Permission `inventory:transfer`. Activity log on every step.

### D3. Stock counts

- **Start**: a location and a scope — all products with stock rows there, or a category, a brand or a product list (active products; stock rows created at 0 where missing). Items snapshot `system_quantity`.
- **Count**: staff set or increment counted quantities (scan = +1). Each save records `system_at_count` = on hand at that moment and `counted_at`.
- **Rule for movements during a count**: an item's adjustment is `counted − system_at_count`, so sales or receipts before the item was counted are already in its system figure and those after it are kept. Uncounted items are not adjusted.
- **Review**: list with system, counted and difference (quantity and value at cost).
- **Complete** (`inventory:approve_count`): posts one `ADJUST` per non-zero difference with reference `stock_count`, refused if the result would make stock negative. Cancel discards it. Only one open count per location and item set overlap is allowed (one open count per location).

### D4. Write-offs

`POST /inventory/write-offs` with location, reason, note and lines; quantities ≤ available; `WRITE_OFF` movements at current cost; total cost stored. Permission `inventory:write_off`. Listed with filters and export (`inventory.write-offs`).

### D5. Barcodes and labels

- Barcode on products, variants and units; entered or generated (internal EAN-13 `20` + 10-digit sequence + check digit). Unique across products, variants and units (checked in one query).
- `GET /inventory/lookup?code=` resolves a barcode or SKU to product/variant/unit. Product search (POS, purchase orders, counts, transfers) matches barcodes exactly.
- Labels: the browser prints a sheet of labels (name, price, barcode as Code 128 SVG via `jsbarcode`) for selected products, a purchase order or a transfer, with a quantity per item and 2 paper layouts (50×30 mm roll, A4 3×8).

### D6. Reorder alerts

Per location: `available = on hand − reserved`; threshold = `max(product.reorder_point, inventory.safety_stock)`; alert when threshold > 0 and available ≤ threshold. Suggested quantity = `reorder_quantity` if set, else `2 × threshold − available`. `GET /inventory/reorder-alerts`, a dashboard card with the count, and `POST /purchase-orders/from-reorder` creating a draft purchase order for chosen alert lines and supplier.

### D7. Reservations and available stock

Sales orders in status `pending` (đặt hàng giữ hàng) reserve their lines at the order's location: `quantity_reserved` is recomputed from pending orders for the affected rows whenever a pending order is created, confirmed, cancelled or edited. Stock checks at checkout, confirmation, transfer shipping and write-off use **available = on hand − reserved**, except that confirming a pending order first releases its own reservation. Back-office orders can be saved as `pending`; `confirm` accepts draft and pending. Screens show on hand, reserved and available.

### D8. Units of measure

A product has a base unit and optional conversion units (factor, optional own barcode and price). A sales or purchase line may name a unit: the line `quantity` counts that unit, stock moves `quantity × unit_factor` base units, and the unit price is the unit's price or the base price × factor (price books apply to the base price first). Returns restock `quantity × unit_factor`. Scanning a unit barcode adds that unit. Purchase-order approval receives `quantity_ordered × unit_factor`.

## Risks / Trade-offs

- **Count accuracy** depends on counting promptly after the system figure is taken; the per-item `system_at_count` keeps sales during long counts correct.
- **Barcode uniqueness across three tables** is enforced in the service, not by one index; a race could slip through and is caught at scan time (the lookup refuses ambiguous codes).
- **Units and promotions**: buy-X-get-Y counts selling units.

## Migration Plan

Apply 027 (columns with defaults, new tables, trigger update). Existing transfer rows (none in practice) get status mapped. Deploy backend then frontend. Rollback restores the previous trigger.

## Open Questions

None blocking.
