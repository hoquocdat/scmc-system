import 'reflect-metadata';
import { randomUUID } from 'crypto';
import {
  Action,
  CaslAbilityFactory,
} from '../../src/casl/casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyHandler,
} from '../../src/casl/check-policies.decorator';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ReportsController } from '../../src/reports/reports.controller';
import { closeTestDb, resetTestDb, testDb } from './db';

/**
 * Verifies the report permission grants seeded by migrations 008 + 022 and
 * that every reports endpoint declares the matching policy.
 */
describe('report permissions', () => {
  let casl: CaslAbilityFactory;
  const userByRole: Record<string, string> = {};

  async function userWithRole(role: string): Promise<string> {
    const id = randomUUID();
    await testDb.user_profiles.create({
      data: { id, role: 'sales', full_name: `User ${role}` },
    });
    const r = await testDb.roles.findUnique({ where: { name: role } });
    if (!r) throw new Error(`role ${role} not seeded`);
    await testDb.user_roles.create({ data: { user_id: id, role_id: r.id } });
    return id;
  }

  beforeAll(async () => {
    await resetTestDb();
    casl = new CaslAbilityFactory(testDb as unknown as PrismaService);
    for (const role of [
      'manager',
      'finance',
      'store_manager',
      'warehouse_staff',
      'sales_associate',
      'technician',
    ]) {
      userByRole[role] = await userWithRole(role);
    }
  });
  afterAll(closeTestDb);

  const can = async (role: string, action: Action) =>
    (await casl.createForUser(userByRole[role])).can(action, 'reports');

  it('grants report actions per role as designed', async () => {
    const matrix: Record<string, Action[]> = {
      manager: [
        Action.Sales,
        Action.Inventory,
        Action.Financial,
        Action.Service,
        Action.Export,
      ],
      finance: [
        Action.Sales,
        Action.Inventory,
        Action.Financial,
        Action.Service,
        Action.Export,
      ],
      store_manager: [
        Action.Sales,
        Action.Inventory,
        Action.Service,
        Action.Export,
      ],
      warehouse_staff: [Action.Inventory],
      sales_associate: [],
      technician: [],
    };
    for (const [role, actions] of Object.entries(matrix)) {
      for (const action of [
        Action.Sales,
        Action.Inventory,
        Action.Financial,
        Action.Service,
        Action.Export,
      ]) {
        expect({ role, action, allowed: await can(role, action) }).toEqual({
          role,
          action,
          allowed: actions.includes(action),
        });
      }
    }
  });

  it('refuses a technician the sales summary and a sales associate the profit report', async () => {
    expect(await can('technician', Action.Sales)).toBe(false);
    expect(await can('sales_associate', Action.Financial)).toBe(false);
    expect(await can('sales_associate', Action.Inventory)).toBe(false);
  });

  it('declares a reports policy on every endpoint', () => {
    const proto = ReportsController.prototype;
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (n) => n !== 'constructor',
    );
    expect(handlers.length).toBeGreaterThan(0);
    const expectedBySection: Record<string, Action> = {
      sales: Action.Sales,
      inventory: Action.Inventory,
      financial: Action.Financial,
      workshop: Action.Service,
      dashboard: Action.Sales,
    };
    const metadata = (key: string, target: object): unknown =>
      Reflect.getMetadata(key, target);
    for (const name of handlers) {
      const handler = proto[name as keyof typeof proto] as unknown as object;
      const policies = metadata(CHECK_POLICIES_KEY, handler) as PolicyHandler[];
      const path = metadata('path', handler) as string;
      const section = path.split('/')[0];
      const expectedPolicy = {
        action: expectedBySection[section],
        subject: 'reports',
      };
      expect({
        name,
        hasPolicy: policies?.some(
          (p) =>
            p.action === expectedPolicy.action &&
            p.subject === expectedPolicy.subject,
        ),
      }).toEqual({
        name,
        hasPolicy: true,
      });
    }
  });
});
