import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ConfigModule } from '@nestjs/config';
import { UserContextService } from './user-context.service';
import { UserContextInterceptor } from './user-context.interceptor';

@Global()
@Module({
  imports: [PassportModule, ConfigModule],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    UserContextService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
  exports: [JwtAuthGuard, UserContextService],
})
export class AuthModule {}
