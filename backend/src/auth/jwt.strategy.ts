import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // For Supabase Auth, the JWT secret is typically the same as the service role key
    // In production, you should use the actual JWT secret from Supabase project settings
    const jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET') ||
                      configService.get<string>('JWT_SECRET') ||
                      'super-secret-jwt-token-with-at-least-32-characters-long'; // Supabase local default

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    // Extract user ID from JWT payload
    const userId = payload.sub;

    if (!userId) {
      throw new UnauthorizedException('Invalid token payload');
    }

    // Fetch user profile from database using Prisma
    const userProfile = await this.prisma.user_profiles.findUnique({
      where: {
        id: userId,
        is_active: true,
      },
    });

    if (!userProfile) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Return user profile to be attached to request object
    return {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
      fullName: userProfile.full_name,
    };
  }
}
