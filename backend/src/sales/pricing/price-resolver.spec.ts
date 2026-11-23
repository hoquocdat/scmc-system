import { resolvePrice } from './price-resolver';

const product = {
  id: 'p1',
  name: 'Jeans A',
  sku: 'JEANS-A',
  retail_price: 1_000_000,
  cost_price: 500_000,
  sale_price: 800_000,
  sale_price_start_date: new Date('2026-03-01T00:00:00+07:00'),
  sale_price_end_date: new Date('2026-03-31T23:59:59+07:00'),
};

describe('resolvePrice', () => {
  it('uses the retail price outside the sale window', () => {
    const r = resolvePrice(
      product,
      null,
      new Date('2026-04-02T10:00:00+07:00'),
    );
    expect(r).toMatchObject({
      unitPrice: 1_000_000,
      unitCost: 500_000,
      source: 'retail',
      variantId: null,
    });
  });

  it('uses the sale price inside the window, inclusive of its bounds', () => {
    expect(
      resolvePrice(product, null, new Date('2026-03-01T00:00:00+07:00'))
        .unitPrice,
    ).toBe(800_000);
    expect(
      resolvePrice(product, null, new Date('2026-03-31T23:59:59+07:00')),
    ).toMatchObject({ unitPrice: 800_000, source: 'sale' });
    expect(
      resolvePrice(product, null, new Date('2026-02-28T23:59:59+07:00'))
        .unitPrice,
    ).toBe(1_000_000);
  });

  it('ignores an expired sale price and one with no value', () => {
    expect(
      resolvePrice(
        { ...product, sale_price_end_date: new Date('2026-01-31') },
        null,
        new Date('2026-03-15'),
      ).unitPrice,
    ).toBe(1_000_000);
    expect(
      resolvePrice(
        { ...product, sale_price: null },
        null,
        new Date('2026-03-15'),
      ).unitPrice,
    ).toBe(1_000_000);
  });

  it('treats open-ended sale dates as unbounded', () => {
    const open = {
      ...product,
      sale_price_start_date: null,
      sale_price_end_date: null,
    };
    expect(resolvePrice(open, null, new Date('2030-01-01')).unitPrice).toBe(
      800_000,
    );
  });

  it('adds the variant adjustment to the current base price', () => {
    const variant = {
      id: 'v1',
      product_id: 'p1',
      name: 'Jeans A / 34',
      sku: 'JEANS-A-34',
      price_adjustment: 50_000,
    };
    expect(
      resolvePrice(product, variant, new Date('2026-03-15')),
    ).toMatchObject({
      unitPrice: 850_000,
      source: 'variant_sale_adjusted',
      unitCost: 500_000,
    });
    expect(
      resolvePrice(product, variant, new Date('2026-05-15')),
    ).toMatchObject({ unitPrice: 1_050_000, source: 'variant_adjusted' });
  });

  it('prefers a variant price override and its own cost', () => {
    const variant = {
      id: 'v2',
      product_id: 'p1',
      name: 'Jeans A / 36',
      sku: 'JEANS-A-36',
      price_adjustment: 50_000,
      retail_price_override: 1_200_000,
      cost_price_override: 400_000,
    };
    expect(
      resolvePrice(product, variant, new Date('2026-03-15')),
    ).toMatchObject({
      unitPrice: 1_200_000,
      unitCost: 400_000,
      source: 'variant_override',
      variantId: 'v2',
      sku: 'JEANS-A-36',
    });
  });
});
