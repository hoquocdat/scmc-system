# Vận hành kho (Inventory operations)

Transfers, counts, write-offs, barcodes and labels, reorder alerts, reservations and units of measure.
Specs: `openspec/specs/inventory/*` (change `inventory-operations`). Migration:
`backend/prisma/migrations/027_inventory_operations.sql` (rollback in `rollback/027_inventory_operations.sql`).

## Available stock

**Available = on hand − reserved.** Reserved stock belongs to sales orders saved as **"Đặt hàng (giữ hàng)"**
(status pending, customer required). POS checkout, confirming other orders, shipping transfers and write-offs
can only use available stock. Confirming the pending order uses its own reservation; cancelling or editing it
updates the reservation. The POS product grid shows available stock.

## Chuyển kho (`/inventory/transfers`)

| Step | Effect |
| --- | --- |
| Tạo phiếu | From, to, items. No stock change. Number `CK-YYMM-#####`. |
| Xuất kho | Shipped quantity per line (≤ requested, ≤ available at the source). Stock leaves the source. |
| Nhận hàng | Quantities received now (cumulative ≤ shipped). Stock arrives at the destination. Can be done in several steps (status "Nhận một phần"). |
| Kết thúc phiếu | Tick "Kết thúc phiếu" when receiving: what was not received is recorded as a discrepancy (thiếu hụt). |
| Hủy | Pending: nothing moves. In transit: unreceived units return to the source. |

Labels for the items can be printed from the transfer.

## Kiểm kho (`/inventory/counts`)

1. **Tạo phiếu kiểm**: a location and a scope — one category, one brand, chosen products, or the whole location.
   Products with variants are counted per variant. One open count per location.
2. **Đếm**: scan a barcode (or type a SKU) and press Enter to add 1, or type the counted quantity per line.
   A scanned item outside the scope is added to the count.
3. **Selling during a count is fine**: each line remembers the system quantity at the moment it was counted,
   and the adjustment is counted − that figure. Lines not counted are not changed.
4. **Cân bằng kho** (needs `inventory:approve_count`): posts one adjustment per difference, shows surplus,
   shortage and value at cost. Example: helmets counted 5 with system 5, one sold afterwards → adjustment 0,
   stock 4; gloves counted 7 with system 9 → −2.

## Xuất hủy (`/inventory/write-offs`)

Damaged, lost, internal use, expired or other; removes stock at the current cost (`XH-YYMM-#####`), limited to
available stock, needs `inventory:write_off`. The list exports to Excel/CSV.

## Barcodes, units and labels

- **Mã vạch** on the product page: type or scan a barcode, or **Tạo mã EAN-13** (internal codes start with 20).
  Barcodes are unique across products, variants and units.
- Scanning works in the POS search, counts, transfers and receiving lines. A unit barcode adds that unit.
- **Đơn vị tính**: the base unit (default "cái") and conversion units with a factor, optional price and
  barcode — e.g. "hộp" = 10 cái at 450,000. Stock is always kept in the base unit: selling 2 boxes removes
  20; returning a box restocks 10; a purchase order line of 5 boxes received adds 50. Without its own price a
  unit costs base price × factor (price books apply to the base price first).
- **In tem**: from the product page, a transfer or a purchase order — name, price and barcode (EAN-13 or
  Code 128), on a 50×30 mm roll or an A4 sheet of 3×8, with a number of labels per item.

## Sắp hết hàng (`/inventory/reorder-alerts`)

An item is low at a location when available stock ≤ its threshold = max(product reorder point, location
safety stock), threshold > 0. Suggested order = the product's reorder quantity, or 2 × threshold − available.
The dashboard shows the count per location. Select lines, choose a supplier and **Tạo đơn đặt hàng nháp**.

## Permissions

| Permission | Granted to |
| --- | --- |
| `inventory:read` | manager, superadmin, store_manager, warehouse_staff, sales, sales_associate, finance |
| `inventory:transfer`, `inventory:count` | manager, superadmin, store_manager, warehouse_staff |
| `inventory:approve_count`, `inventory:write_off` | manager, superadmin, store_manager |
| `inventory:labels` | everyone above |
| Barcodes and units (`products:update`) | as for editing products |

## Not covered

Serial/lot/expiry tracking, bins, automatic purchase orders, and choosing the receiving location of a purchase
order (it uses the default location as before).
