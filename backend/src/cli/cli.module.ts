import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CreateUserCommand, CreateUserQuestions, ConfirmQuestions } from './commands/create-user.command';
import { SeedEmployeesCommand } from './commands/seed-employees.command';
import { SeedBrandsCommand } from './commands/seed-brands.command';
import { SeedDataCommand } from './commands/seed-data.command';
import { VerifySeedCommand } from './commands/verify-seed.command';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
  ],
  providers: [
    CreateUserCommand,
    CreateUserQuestions,
    ConfirmQuestions,
    SeedEmployeesCommand,
    SeedBrandsCommand,
    SeedDataCommand,
    VerifySeedCommand,
  ],
})
export class CliModule {}
