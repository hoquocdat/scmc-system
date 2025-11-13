import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from './casl-ability.factory';

export interface PolicyHandler {
  action: Action;
  subject: Subjects;
}

export const CHECK_POLICIES_KEY = 'check_policies';

/**
 * Decorator to check policies on controller methods
 * @param policies - Array of policy handlers defining required permissions
 *
 * Usage:
 * @CheckPolicies({ action: Action.Read, subject: 'products' })
 * @CheckPolicies({ action: Action.Create, subject: 'products' })
 * @CheckPolicies({ action: Action.Update, subject: 'products' })
 */
export const CheckPolicies = (...policies: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, policies);
