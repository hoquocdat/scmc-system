import {
  allocateOrderReductions,
  proportionalPoints,
  refundFor,
  ReturnQuantityError,
} from './return-math';

const line = (
  id: string,
  unit_price: number,
  quantity: number,
  discount_amount = 0,
  tax_amount = 0,
) => ({
  id,
  unit_price,
  quantity,
  discount_amount,
  tax_amount,
});

describe('return math', () => {
  it('order discount is shared in proportion: jeans 1,000,000 + helmet 3,000,000 − 400,000', () => {
    const paid = allocateOrderReductions(
      [line('jeans', 1_000_000, 1), line('helmet', 3_000_000, 1)],
      400_000,
    );
    expect(paid.get('jeans')).toBe(900_000);
    expect(paid.get('helmet')).toBe(2_700_000);
  });

  it('shares add up exactly (largest remainder) and include line discount and tax', () => {
    const lines = [
      line('a', 100_000, 1),
      line('b', 100_000, 1),
      line('c', 100_000, 1, 10_000, 5_000),
    ];
    const paid = allocateOrderReductions(lines, 100_000);
    const sum = [...paid.values()].reduce((s, x) => s + x, 0);
    expect(sum).toBe(100_000 + 100_000 + 95_000 - 100_000);
  });

  it('loyalty discount counts as an order reduction and never exceeds the order', () => {
    const paid = allocateOrderReductions([line('a', 50_000, 2)], 500_000);
    expect(paid.get('a')).toBe(0);
  });

  it('unit by unit: 33,333 / 33,333 / 33,334', () => {
    const l = {
      paidValue: 100_000,
      quantity: 3,
      returnedQuantity: 0,
      returnedAmount: 0,
    };
    const r1 = refundFor(l, 1);
    const r2 = refundFor({ ...l, returnedQuantity: 1, returnedAmount: r1 }, 1);
    const r3 = refundFor(
      { ...l, returnedQuantity: 2, returnedAmount: r1 + r2 },
      1,
    );
    expect([r1, r2, r3]).toEqual([33_333, 33_333, 33_334]);
  });

  it('never refunds more than was paid, whatever the order of partial returns', () => {
    for (let q = 1; q <= 7; q++) {
      for (const paidValue of [1, 7, 99_999, 1_000_001]) {
        let returned = 0;
        let amount = 0;
        while (returned < q) {
          const k = Math.min(2, q - returned);
          amount += refundFor(
            {
              paidValue,
              quantity: q,
              returnedQuantity: returned,
              returnedAmount: amount,
            },
            k,
          );
          returned += k;
          expect(amount).toBeLessThanOrEqual(paidValue);
        }
        expect(amount).toBe(paidValue);
      }
    }
  });

  it('refuses more than remains', () => {
    expect(() =>
      refundFor(
        { paidValue: 1, quantity: 3, returnedQuantity: 1, returnedAmount: 0 },
        3,
      ),
    ).toThrow(ReturnQuantityError);
    expect(() =>
      refundFor(
        { paidValue: 1, quantity: 3, returnedQuantity: 0, returnedAmount: 0 },
        0,
      ),
    ).toThrow(ReturnQuantityError);
  });

  it('loyalty: half returned reverses 50 of 100 earned and restores 25 of 50 redeemed; full return takes the rest', () => {
    expect(proportionalPoints(100, 0, 500_000, 1_000_000, false)).toBe(50);
    expect(proportionalPoints(50, 0, 500_000, 1_000_000, false)).toBe(25);
    expect(proportionalPoints(100, 50, 500_000, 1_000_000, true)).toBe(50);
    expect(proportionalPoints(100, 99, 900_000, 1_000_000, false)).toBe(1);
    expect(proportionalPoints(0, 0, 1, 1, true)).toBe(0);
  });
});
