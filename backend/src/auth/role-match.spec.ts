import { roleMatches } from './role-match';

describe('roleMatches', () => {
  it('superadmin passes any list', () => {
    expect(roleMatches('superadmin', ['manager', 'finance'])).toBe(true);
  });
  it('legacy names map to the real roles', () => {
    expect(roleMatches('warehouse_staff', ['admin', 'manager', 'warehouse', 'sales'])).toBe(true);
    expect(roleMatches('sales_associate', ['admin', 'manager', 'warehouse', 'sales'])).toBe(true);
    expect(roleMatches('finance', ['admin', 'manager', 'warehouse', 'sales'])).toBe(false);
  });
  it('exact roles still decide; no user, no access', () => {
    expect(roleMatches('store_manager', ['manager', 'store_manager'])).toBe(true);
    expect(roleMatches('technician', ['manager'])).toBe(false);
    expect(roleMatches(undefined, ['manager'])).toBe(false);
  });
});
