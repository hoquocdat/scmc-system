# CLI Commands

This project uses **Nest Commander** for CLI commands, providing a consistent NestJS-based command-line interface.

## Available Commands

### Create User

Create a new user with a specified role.

```bash
npm run cli -- create:user
```

**Interactive Prompts:**
- Full Name
- Email
- Phone (optional)
- Role selection:
  1. Manager (Full access)
  2. Store Manager (POS + Inventory)
  3. Sales (Service orders)
  4. Sales Associate (POS sales)
  5. Technician (Service execution)
  6. Warehouse Staff (Inventory)
  7. Finance (Payments)
- Password (minimum 6 characters)
- Password confirmation

**Example:**
```bash
$ npm run cli -- create:user

🔐 Create User

This command will create a new user with the specified role.

? Full Name: John Doe
? Email: john@scmc.vn
? Phone (optional, press Enter to skip): 0901234567
? Select role: Manager (Full access)
? Password (min 6 characters): [hidden]
? Confirm Password: [hidden]

📋 Review user details:

  Name:  John Doe
  Email: john@scmc.vn
  Phone: 0901234567
  Role:  manager

? Create this user? Yes

🔄 Creating user account...

📝 Hashing password...
✅ Password hashed

📝 Creating user profile in database...
✅ User profile created

✨ Success! User created:

┌──────────────────────────────────────────────────────┐
│ Name:  John Doe                                      │
│ Email: john@scmc.vn                                  │
│ Phone: 0901234567                                    │
│ Role:  manager                                       │
│ ID:    a1b2c3d4-e5f6-7890-abcd-ef1234567890         │
└──────────────────────────────────────────────────────┘

💡 User can now log in with their email and password.
```

## Help

View all available commands:

```bash
npm run cli -- --help
```

View help for a specific command:

```bash
npm run cli -- create:user --help
```

## Adding New Commands

To add a new command:

1. Create a new command file in `src/cli/commands/`:

```typescript
import { Command, CommandRunner, InquirerService } from 'nest-commander';
import { Injectable } from '@nestjs/common';

@Injectable()
@Command({
  name: 'my:command',
  description: 'Description of my command',
})
export class MyCommand extends CommandRunner {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run(): Promise<void> {
    // Command logic here
  }
}
```

2. Add the command to `src/cli/cli.module.ts`:

```typescript
@Module({
  imports: [PrismaModule],
  providers: [
    CreateUserCommand,
    CreateUserQuestions,
    ConfirmQuestions,
    MyCommand, // Add your command here
  ],
})
export class CliModule {}
```

3. Run the command:

```bash
npm run cli -- my:command
```

## Benefits of Nest Commander

- **Dependency Injection**: Reuse existing NestJS services (PrismaService, etc.)
- **Type Safety**: Full TypeScript support
- **Interactive Prompts**: Built-in inquirer integration
- **Validation**: Use class-validator decorators
- **Auto-generated Help**: Automatic `--help` generation
- **Consistent Architecture**: Same patterns as the rest of the NestJS app

## Migration Notes

The old `scripts/create-superadmin.ts` script has been replaced by the new `create:user` command. The new command:

- ✅ Uses NestJS dependency injection
- ✅ Reuses PrismaService (no direct PostgreSQL client needed)
- ✅ Supports all user roles (not just manager)
- ✅ Has proper validation and error handling
- ✅ Works with pure PostgreSQL (no Supabase dependency)
- ✅ Uses bcrypt for password hashing
- ✅ Professional interactive UI

## Legacy Scripts

For reference, the old script-based commands are still available:

```bash
npm run create:superadmin  # Old script (deprecated, use 'npm run cli -- create:user' instead)
npm run seed:employees     # Seed employee data
npm run seed:brands        # Seed brands and models
npm run seed:data          # Seed service data
npm run seed:all          # Run all seed scripts
```

**Recommendation**: Migrate these seed scripts to Nest Commander commands for consistency.
