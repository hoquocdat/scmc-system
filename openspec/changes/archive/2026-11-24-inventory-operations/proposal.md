# Proposal

## Why

Phase 2 of `docs/POS-plan.md` is only partly done. Stock levels, adjustments and purchase receiving work, but SCMC cannot move stock between HCMC, Hanoi and the workshop (the `transfer_orders` tables exist with no module or screen), cannot run a stock count, has no barcode on products, and gets no reorder alerts. With two branches selling the same items, these gaps cause the stock errors the POS is meant to remove.

## What Changes

- Stock transfers between locations: create, ship (stock leaves the source), receive (stock arrives at the destination) with partial receiving and recorded discrepancies; states Pending, In Transit, Received, Cancelled.
- Stock counts (kiểm kho): count a whole location or a selection (category, brand, product list); enter or scan counted quantities; review differences; approve to post adjustments. Stock movements during an open count are handled by a rule set in design.
- Write-off (xuất hủy) as a distinct, reasoned stock removal (damaged, lost, used internally) with permission, separate from general adjustments.
- Barcodes: a barcode field on products and variants (unique), generated or entered; scanning works in POS, counts, transfers and receiving.
- Label printing: print barcode labels (name, price, barcode) for selected products or for the items of a purchase order or transfer.
- Reorder alerts: products at or below their reorder point per location, with suggested order quantity, shown on a dashboard card and list, and usable to start a purchase order.
- Stock reservations: confirmed but unfulfilled sales orders reserve stock (`quantity_reserved` already exists), and available stock (on hand minus reserved) is what POS and order screens show.
- Units of measure: a base unit and conversion units per product (for example piece and box of 10) for selling and purchasing.

## Capabilities

### New Capabilities
- `inventory/stock-transfers`: Moving stock between locations with ship and receive steps.
- `inventory/stock-counts`: Counting stock, reviewing differences and posting adjustments.
- `inventory/write-offs`: Reasoned removal of stock that will not be sold.
- `inventory/barcodes`: Product and variant barcodes, scanning, and label printing.
- `inventory/reorder-alerts`: Low-stock detection and suggested reorders per location.
- `inventory/stock-reservations`: Reserving stock for confirmed orders and computing available stock.
- `inventory/units-of-measure`: Base and conversion units for selling and buying.

### Modified Capabilities
<!-- None in openspec/specs yet. -->

## Impact

- **Backend**: new `src/stock-transfers` and `src/stock-counts` modules; `src/inventory` (write-off type, reservations, available stock); `src/products` (barcode, units); `src/purchase-orders` (start PO from reorder alert, units).
- **Database**: raw SQL migration for count tables, barcode and unit columns and tables; uses existing `transfer_orders`/`transfer_order_items`.
- **Frontend**: transfer pages, count pages (scan-friendly), write-off Sheet, label print dialog, reorder alerts card/page; routes under `/inventory`.
- **Hardware**: USB/Bluetooth barcode scanners acting as keyboards; labels printed through the browser.
- **Depends on**: none strictly; barcode scanning at POS benefits `pos-checkout-core`. **Feeds**: `reports-retail-suite` (stock card, transfers, count variances).

## Out of Scope

- Serial number, lot or expiry tracking.
- Warehouse bins/shelf locations.
- Automatic purchase orders without staff confirmation.
