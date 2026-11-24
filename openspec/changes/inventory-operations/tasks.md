# Tasks

## 1. Database migration

- [ ] 1.1 Write `backend/prisma/migrations/027_inventory_operations.sql` (D1): transfer columns and status check, counts, write-offs, barcodes, units, unit columns on sales and purchase lines, trigger update, permissions; verify with `\d`, the trigger on `WRITE_OFF`, and barcode uniqueness per table
- [ ] 1.2 Rollback; up/down/up on the test database; apply to dev; `prisma db pull && generate` (remove the `license_plate` artefact); build

## 2. Stock core

- [ ] 2.1 Shared stock helpers: available quantity with row locks, ensure row, current cost, document numbers (CK/KK/XH)
- [ ] 2.2 Reservations: recompute from pending orders; pending create/confirm/cancel; available-stock checks in posting (D7); verify reservation scenarios and that existing suites pass

## 3. Operations

- [ ] 3.1 Transfers service and API (D2); verify ship/receive, shortage, partial with discrepancy, cancel in transit, permissions
- [ ] 3.2 Counts service and API (D3); verify the sale-after-counting and shortage scenarios, one open count per location, approval permission
- [ ] 3.3 Write-offs service and API with list/export (D4); verify scenarios and permission
- [ ] 3.4 Barcodes: fields, uniqueness across tables, EAN-13 generation, lookup, product search by barcode (D5); verify duplicate and generation scenarios
- [ ] 3.5 Reorder alerts and draft PO from alerts (D6); verify scenarios
- [ ] 3.6 Units: CRUD on products, posting with unit factor and price, returns restock, PO approval with factor, lookup by unit barcode (D8); verify box scenarios

## 4. Frontend

- [ ] 4.1 API clients (`lib/api/stock-transfers.ts`, `stock-counts.ts`, `write-offs.ts`, inventory extras)
- [ ] 4.2 `/inventory/transfers` list, create Sheet, detail with ship/receive/cancel
- [ ] 4.3 `/inventory/counts` list, start Sheet, scan-friendly count page, review and complete
- [ ] 4.4 `/inventory/write-offs` list and create Sheet
- [ ] 4.5 Barcode and units on the product form, label print dialog (products list, purchase order, transfer) with `jsbarcode`
- [ ] 4.6 Reorder alerts page and dashboard card with "create purchase order"
- [ ] 4.7 Reserved/available on stock levels and POS; pending orders ("Đặt hàng") on the sales-order form; unit choice on POS and sales-order lines
- [ ] 4.8 Navigation entries gated by permissions

## 5. Checks

- [ ] 5.1 All suites, both builds, lint on new files
- [ ] 5.2 `docs/inventory/INVENTORY_OPERATIONS.md`
