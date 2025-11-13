import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY, PolicyHandler } from './check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policies =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ||
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getClass(),
      );

    // If no policies are defined, allow access (endpoint is not protected by CASL)
    if (!policies || policies.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated
    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Create ability for user
    const ability = await this.caslAbilityFactory.createForUser(user.id);

    // Check all policies - user must have ALL specified permissions
    for (const policy of policies) {
      const hasPermission = ability.can(policy.action, policy.subject);

      if (!hasPermission) {
        throw new ForbiddenException(
          `You don't have permission to ${policy.action} ${policy.subject}`,
        );
      }
    }

    // All policy checks passed
    return true;
  }
}
