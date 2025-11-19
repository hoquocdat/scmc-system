import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CreateUserCommand, CreateUserQuestions, ConfirmQuestions } from './commands/create-user.command';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
  ],
  providers: [CreateUserCommand, CreateUserQuestions, ConfirmQuestions],
})
export class CliModule {}
