# Bảng giá (Price books)

Price books give special prices by branch, customer group and period, so staff stop typing manual
line discounts. Specs: `openspec/specs/pricing/price-books`, `pricing/price-resolution`,
`customers/customer-groups` (change `price-books`). Migration: `backend/prisma/migrations/024_price_books.sql`
(rollback in `rollback/024_price_books.sql`).

## Concepts

| Term | Meaning |
| --- | --- |
| Giá chung (base price) | The existing product rule: a variant's own retail price, else the product's sale price inside its dates or its retail price, plus the variant's price adjustment. With no price book, this is the price. |
| Bảng giá (price book) | A named list with a priority, optional start/end time, branch condition (all or listed branches), customer condition (all customers or listed groups), and whether staff may choose it at the counter. |
| Dòng bảng giá (entry) | One product (all its variants) or one variant, priced **fixed**, **percent off** the base price, or **amount off** the base price. |
| Nhóm khách hàng (customer group) | Wholesale, VIP, partner workshop… A customer may be in several groups. |

## How the price of a line is chosen

1. Take the books that are active, inside their dates, valid for the branch and for the customer
   (customer in one of the book's groups, or the book is for all customers). A walk-in sale only
   matches books for all customers. Inactive groups do not count.
2. Keep the books with an entry for the item: the variant's own entry first, else the product's.
3. Highest priority wins; ties go to the later start time, then the code.
4. Fixed → that price. Percent off → base × (100 − %) rounded to whole đồng. Amount off → base −
   amount, not below 0. A book replaces the base price even when higher (planned price increases).
5. No book → base price.

**Manual choice:** staff with `price_books:apply` (store managers, managers) can pick one book for
the whole sale in POS or in the sales-order form. The book must allow manual choice, be active,
inside its dates and valid for the branch; its customer condition is ignored. Items not in that book
are sold at the base price (no other book is consulted).

Each sold line records its price, base price and price book; changing or deleting a book later
does not change past sales.

### Examples

| Situation | Price |
| --- | --- |
| Helmet H1 retail 2,000,000; customer in "Wholesale"; "Giá sỉ" (priority 10) has H1 fixed 1,800,000 | 1,800,000 from Giá sỉ |
| Same customer also in "Partner"; "Đối tác" (priority 20) has H1 fixed 1,700,000 | 1,700,000 from Đối tác |
| Gloves G1 base 500,000, size XL +20,000; "VIP" has G1 at 10 % off | G1 XL = 468,000 |
| "Giá Hà Nội" only for the Hanoi branch; sale at HCMC | base price |
| Store manager picks "Giá sỉ" for a walk-in partner buying H1 and G1 (G1 not in the book) | H1 1,800,000; G1 base price |

## Setting up

**Wholesale prices**

1. **Khách hàng → Nhóm khách hàng**: create "Khách sỉ" (`WHOLESALE`).
2. Open each wholesale customer → Edit → tick "Khách sỉ" (saved immediately). The customer list can
   be filtered by group.
3. **Hàng hóa → Bảng giá → Thêm bảng giá**: code `GIA-SI`, priority 10, no branch selected (all),
   group "Khách sỉ"; tick "Cho phép chọn tay khi bán" if partners without an account should get it.
4. **Thêm mặt hàng**: pick products, or a whole category/brand, with a rule (for example 15 % off),
   or **Nhập Excel**.

**Branch prices**: create a book with only that branch ticked and no group (all customers).

**Planned price change**: create a book with a start time, all branches and customers, a higher
priority, and fixed prices; it applies automatically from that time. POS carts built before that
moment are re-priced at checkout (`PRICE_CHANGED`).

The book list warns (⚠) when two active books share a priority.

## Excel import / export

**Xuất Excel** downloads the book's entries; use it as the template. **Nhập Excel** reads the first
sheet, header row required:

| Column | Required | Values |
| --- | --- | --- |
| `SKU` | yes | product SKU |
| `Variant SKU` | no | variant SKU; empty = the entry applies to every variant |
| `Mode` | yes | `fixed` / `percent_off` / `amount_off`, or `Giá cố định` / `Giảm %` / `Giảm tiền` |
| `Value` | yes | price, percent (0–100) or amount |

Existing entries for the same item are updated. If any row is invalid (unknown SKU, variant of
another product, bad mode or value, duplicate row) nothing is written and every bad row is listed.
At most 5,000 rows per file.

## Permissions

| Permission | Granted to |
| --- | --- |
| `price_books:read` (see books, prices at POS) | manager, superadmin, finance, store_manager, sales, sales_associate |
| `price_books:create / update / delete` | manager, superadmin |
| `price_books:apply` (choose a book for a sale) | manager, superadmin, store_manager |
| `customer_groups:read` | everyone above |
| `customer_groups:create / update` | manager, superadmin, store_manager |
| `customer_groups:delete` | manager, superadmin (refused while the group has members or a book uses it; deactivate instead) |

## Behaviour changes

- POS cart and the sales-order form show the server price of each line and the price book that
  set it; the sales-order form no longer has an editable unit price (the server always ignored it).
- Adding an item to an existing back-office order now prices it on the server (order's branch,
  customer and chosen book) instead of trusting the price sent by the screen.

## API

`/price-books` (CRUD), `/price-books/:id/entries` (GET list with base and resulting price, PUT
upsert), `/price-books/:id/entries/bulk`, `/price-books/:id/entries/:entryId` (PATCH, DELETE),
`/price-books/:id/export`, `/price-books/:id/import` (multipart `file`), `/pricing/quote`,
`/pricing/applicable-books`, `/customer-groups` (CRUD), `/customers/:id/groups` (GET, PUT),
`/customers?groupId=`. Checkout and `POST /sales` accept `price_book_id`.
