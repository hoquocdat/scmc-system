import { Command, CommandRunner, InquirerService, Question, QuestionSet } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { user_role } from '@prisma/client';

interface CreateUserAnswers {
  fullName: string;
  email: string;
  phone?: string;
  role: user_role;
  password: string;
}

@Injectable()
@QuestionSet({ name: 'create-user' })
export class CreateUserQuestions {
  @Question({
    type: 'input',
    name: 'fullName',
    message: 'Full Name:',
    validate: (input: string) => {
      if (!input.trim()) {
        return 'Full name is required!';
      }
      return true;
    },
  })
  parseFullName(val: string) {
    return val.trim();
  }

  @Question({
    type: 'input',
    name: 'email',
    message: 'Email:',
    validate: (input: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!input.trim()) {
        return 'Email is required!';
      }
      if (!emailRegex.test(input)) {
        return 'Invalid email format!';
      }
      return true;
    },
  })
  parseEmail(val: string) {
    return val.trim().toLowerCase();
  }

  @Question({
    type: 'input',
    name: 'phone',
    message: 'Phone (optional, press Enter to skip):',
    validate: (input: string) => {
      if (!input.trim()) {
        return true; // Allow empty
      }
      const phoneRegex = /^(\+84|84|0)[0-9]{9,10}$/;
      if (!phoneRegex.test(input.replace(/\s/g, ''))) {
        return 'Invalid phone format! Use format: +84901234567 or 0901234567';
      }
      return true;
    },
  })
  parsePhone(val: string) {
    return val.trim() || undefined;
  }

  @Question({
    type: 'list',
    name: 'role',
    message: 'Select role:',
    choices: [
      { name: '1. Manager (Full access)', value: 'manager' },
      { name: '2. Store Manager (POS + Inventory)', value: 'store_manager' },
      { name: '3. Sales (Service orders)', value: 'sales' },
      { name: '4. Sales Associate (POS sales)', value: 'sales_associate' },
      { name: '5. Technician (Service execution)', value: 'technician' },
      { name: '6. Warehouse Staff (Inventory)', value: 'warehouse_staff' },
      { name: '7. Finance (Payments)', value: 'finance' },
    ],
    default: 'manager',
  })
  parseRole(val: user_role) {
    return val;
  }

  @Question({
    type: 'password',
    name: 'password',
    message: 'Password (min 6 characters):',
    validate: (input: string) => {
      if (input.length < 6) {
        return 'Password must be at least 6 characters!';
      }
      return true;
    },
  })
  parsePassword(val: string) {
    return val;
  }

  @Question({
    type: 'password',
    name: 'confirmPassword',
    message: 'Confirm Password:',
    validate: (input: string, answers?: CreateUserAnswers & { confirmPassword: string }) => {
      if (answers && input !== answers.password) {
        return 'Passwords do not match!';
      }
      return true;
    },
  })
  parseConfirmPassword(val: string) {
    return val;
  }
}

@Injectable()
@Command({
  name: 'create:user',
  description: 'Create a new user with specified role',
})
export class CreateUserCommand extends CommandRunner {
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inquirer: InquirerService,
    private readonly config: ConfigService,
  ) {
    super();

    // Initialize Supabase client for Auth
    const supabaseUrl = this.config.get<string>('SUPABASE_URL') || 'http://127.0.0.1:54321';
    const supabaseServiceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async run(): Promise<void> {
    console.log('\n🔐 Create User\n');
    console.log('This command will create a new user with the specified role.\n');

    try {
      // Get user input through interactive prompts
      const answers = await this.inquirer.ask<CreateUserAnswers>('create-user', undefined);

      // Show review
      console.log('\n📋 Review user details:\n');
      console.log(`  Name:  ${answers.fullName}`);
      console.log(`  Email: ${answers.email}`);
      if (answers.phone) {
        console.log(`  Phone: ${answers.phone}`);
      }
      console.log(`  Role:  ${answers.role}`);

      // Confirm
      const { confirmed } = await this.inquirer.ask<{ confirmed: boolean }>('confirm', undefined);

      if (!confirmed) {
        console.log('\n❌ Cancelled. No user was created.\n');
        return;
      }

      // Check if user already exists
      const existingUser = await this.prisma.user_profiles.findFirst({
        where: { email: answers.email },
      });

      if (existingUser) {
        console.error('\n❌ Error: A user with this email already exists!\n');
        return;
      }

      console.log('\n🔄 Creating user account...\n');

      // Step 1: Create auth user in Supabase Auth
      console.log('📝 Creating authentication account in Supabase...');
      const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
        email: answers.email,
        password: answers.password,
        email_confirm: true,
        user_metadata: {
          full_name: answers.fullName,
          phone: answers.phone || null,
          role: answers.role,
        },
      });

      if (authError) {
        throw new Error(`Supabase Auth error: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Failed to create authentication account');
      }

      console.log('✅ Authentication account created');
      console.log(`   User ID: ${authData.user.id}`);

      // Step 2: Create user profile in PostgreSQL database
      console.log('\n📝 Creating user profile in database...');
      try {
        const user = await this.prisma.user_profiles.create({
          data: {
            id: authData.user.id,  // Use Supabase Auth user ID
            full_name: answers.fullName,
            email: answers.email,
            phone: answers.phone,
            role: answers.role,
            is_active: true,
          },
        });

        console.log('✅ User profile created');

        // Success summary
        console.log('\n✨ Success! User created:\n');
        console.log('┌──────────────────────────────────────────────────────┐');
        console.log(`│ Name:  ${answers.fullName.padEnd(44)} │`);
        console.log(`│ Email: ${answers.email.padEnd(44)} │`);
        if (answers.phone) {
          console.log(`│ Phone: ${answers.phone.padEnd(44)} │`);
        }
        console.log(`│ Role:  ${answers.role.padEnd(44)} │`);
        console.log(`│ ID:    ${user.id.padEnd(44)} │`);
        console.log('└──────────────────────────────────────────────────────┘');
        console.log('\n💡 User can now log in with their email and password.\n');
      } catch (profileError) {
        // If profile creation fails, clean up Supabase Auth user
        console.error('\n❌ Failed to create user profile. Attempting cleanup...');
        await this.supabase.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Profile error: ${profileError instanceof Error ? profileError.message : profileError}`);
      }
    } catch (error) {
      console.error('\n❌ Error creating user:', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

@Injectable()
@QuestionSet({ name: 'confirm' })
export class ConfirmQuestions {
  @Question({
    type: 'confirm',
    name: 'confirmed',
    message: 'Create this user?',
    default: false,
  })
  parseConfirm(val: boolean) {
    return val;
  }
}
