import {
  applyEntry,
  bookApplies,
  bookChoosable,
  priceFromBooks,
  PriceBookRule,
} from './price-book-rule';

const HCM = 'store-hcm';
const HN = 'store-hn';
const WHOLESALE = 'grp-wholesale';
const PARTNER = 'grp-partner';
const H1 = 'prod-h1';
const G1 = 'prod-g1';
const G1_XL = 'var-g1-xl';

const book = (over: Partial<PriceBookRule>): PriceBookRule => ({
  id: over.code ?? 'b',
  code: 'B',
  name: 'Book',
  priority: 0,
  is_active: true,
  start_at: null,
  end_at: null,
  all_stores: true,
  all_customers: true,
  allow_manual: false,
  store_ids: [],
  group_ids: [],
  entries: [],
  ...over,
});

const wholesale = book({
  code: 'SI',
  name: 'Giá sỉ',
  priority: 10,
  all_customers: false,
  group_ids: [WHOLESALE],
  allow_manual: true,
  entries: [
    {
      product_id: H1,
      product_variant_id: null,
      mode: 'fixed',
      value: 1_800_000,
    },
  ],
});
const partner = book({
  code: 'DT',
  name: 'Đối tác',
  priority: 20,
  all_customers: false,
  group_ids: [PARTNER],
  entries: [
    {
      product_id: H1,
      product_variant_id: null,
      mode: 'fixed',
      value: 1_700_000,
    },
  ],
});
const at = new Date('2027-01-10T03:00:00Z');

describe('price book rule', () => {
  it('no books: base price', () => {
    expect(priceFromBooks([], 2_000_000, H1, null)).toBeNull();
  });

  it('wholesale customer gets the wholesale price', () => {
    const ctx = { at, storeId: HCM, customerGroupIds: [WHOLESALE] };
    const books = [wholesale, partner].filter((b) => bookApplies(b, ctx));
    const p = priceFromBooks(books, 2_000_000, H1, null);
    expect(p?.unitPrice).toBe(1_800_000);
    expect(p?.book.name).toBe('Giá sỉ');
  });

  it('walk-in matches only books for all customers', () => {
    const ctx = { at, storeId: HCM, customerGroupIds: [] };
    expect(bookApplies(wholesale, ctx)).toBe(false);
    expect(bookApplies(book({}), ctx)).toBe(true);
  });

  it('higher priority wins', () => {
    const ctx = { at, storeId: HCM, customerGroupIds: [WHOLESALE, PARTNER] };
    const books = [wholesale, partner].filter((b) => bookApplies(b, ctx));
    expect(priceFromBooks(books, 2_000_000, H1, null)?.unitPrice).toBe(
      1_700_000,
    );
  });

  it('tie broken by later start, then code', () => {
    const a = book({
      code: 'A',
      start_at: new Date('2027-01-01'),
      entries: wholesale.entries,
    });
    const b = book({
      code: 'B',
      start_at: new Date('2027-01-05'),
      entries: partner.entries,
    });
    expect(priceFromBooks([a, b], 2_000_000, H1, null)?.book.code).toBe('B');
    const c = book({ code: 'C', entries: wholesale.entries });
    const d = book({ code: 'D', entries: partner.entries });
    expect(priceFromBooks([d, c], 2_000_000, H1, null)?.book.code).toBe('C');
  });

  it('branch condition', () => {
    const hanoi = book({ all_stores: false, store_ids: [HN] });
    expect(bookApplies(hanoi, { at, storeId: HCM, customerGroupIds: [] })).toBe(
      false,
    );
    expect(bookApplies(hanoi, { at, storeId: HN, customerGroupIds: [] })).toBe(
      true,
    );
  });

  it('book outside its dates', () => {
    const tet = book({ end_at: new Date('2027-02-15T16:59:59Z') });
    expect(
      bookApplies(tet, {
        at: new Date('2027-02-16T03:00:00Z'),
        customerGroupIds: [],
      }),
    ).toBe(false);
    expect(bookApplies(tet, { at, customerGroupIds: [] })).toBe(true);
  });

  it('inactive book never applies', () => {
    expect(
      bookApplies(book({ is_active: false }), { at, customerGroupIds: [] }),
    ).toBe(false);
  });

  it('percent off a variant uses the variant base; variant entry beats product entry', () => {
    const vip = book({
      entries: [
        {
          product_id: G1,
          product_variant_id: null,
          mode: 'percent_off',
          value: 10,
        },
      ],
    });
    // base 500,000 + 20,000 XL adjustment
    expect(priceFromBooks([vip], 520_000, G1, G1_XL)?.unitPrice).toBe(468_000);
    const withVariant = book({
      entries: [
        ...vip.entries,
        {
          product_id: G1,
          product_variant_id: G1_XL,
          mode: 'fixed',
          value: 450_000,
        },
      ],
    });
    expect(priceFromBooks([withVariant], 520_000, G1, G1_XL)?.unitPrice).toBe(
      450_000,
    );
  });

  it('relative prices: rounding and not below zero', () => {
    expect(
      applyEntry(333_333, {
        product_id: G1,
        product_variant_id: null,
        mode: 'percent_off',
        value: 15,
      }),
    ).toBe(283_333);
    expect(
      applyEntry(100_000, {
        product_id: G1,
        product_variant_id: null,
        mode: 'amount_off',
        value: 150_000,
      }),
    ).toBe(0);
    expect(
      applyEntry(100_000, {
        product_id: G1,
        product_variant_id: null,
        mode: 'fixed',
        value: 250_000,
      }),
    ).toBe(250_000);
  });

  it('manual choice waives the customer condition but needs allow_manual and the branch', () => {
    expect(bookChoosable(wholesale, { at, storeId: HCM })).toBe(true);
    expect(bookChoosable(partner, { at, storeId: HCM })).toBe(false);
    expect(
      bookChoosable(
        book({ allow_manual: true, all_stores: false, store_ids: [HN] }),
        { at, storeId: HCM },
      ),
    ).toBe(false);
    // item not in the chosen book: base price (no other book consulted)
    expect(priceFromBooks([wholesale], 500_000, G1, null)).toBeNull();
  });
});
