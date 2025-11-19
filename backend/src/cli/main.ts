#!/usr/bin/env node

import { CommandFactory } from 'nest-commander';
import { CliModule } from './cli.module';

async function bootstrap() {
  await CommandFactory.run(CliModule, {
    logger: ['error', 'warn'],
    errorHandler: (error) => {
      console.error('\n💥 Command failed:', error.message);
      process.exit(1);
    },
  });
}

bootstrap();
