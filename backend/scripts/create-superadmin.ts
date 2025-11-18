#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface UserInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  role: 'manager' | 'sales' | 'technician' | 'finance' | 'store_manager' | 'sales_associate' | 'warehouse_staff';
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify question
function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format (Vietnamese)
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+84|84|0)[0-9]{9,10}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

async function getUserInput(): Promise<UserInput> {
  console.log('\n🔐 Create Superadmin User\n');
  console.log('This script will create a new user with admin privileges.\n');

  // Get full name
  let fullName = '';
  while (!fullName.trim()) {
    fullName = await question('Full Name: ');
    if (!fullName.trim()) {
      console.log('❌ Full name is required!\n');
    }
  }

  // Get email
  let email = '';
  while (!email.trim() || !isValidEmail(email)) {
    email = await question('Email: ');
    if (!email.trim()) {
      console.log('❌ Email is required!\n');
    } else if (!isValidEmail(email)) {
      console.log('❌ Invalid email format!\n');
    }
  }

  // Get phone (optional)
  let phone = '';
  let phoneValid = false;
  while (!phoneValid) {
    phone = await question('Phone (optional, press Enter to skip): ');
    if (!phone.trim()) {
      phoneValid = true; // Allow empty phone
    } else if (isValidPhone(phone)) {
      phoneValid = true;
    } else {
      console.log('❌ Invalid phone format! Use format: +84901234567 or 0901234567\n');
    }
  }

  // Get role
  console.log('\nAvailable roles:');
  console.log('  1. manager (Full access)');
  console.log('  2. store_manager (POS + Inventory)');
  console.log('  3. sales (Service orders)');
  console.log('  4. sales_associate (POS sales)');
  console.log('  5. technician (Service execution)');
  console.log('  6. warehouse_staff (Inventory)');
  console.log('  7. finance (Payments)');

  const roleMap: Record<string, UserInput['role']> = {
    '1': 'manager',
    '2': 'store_manager',
    '3': 'sales',
    '4': 'sales_associate',
    '5': 'technician',
    '6': 'warehouse_staff',
    '7': 'finance',
  };

  let role: UserInput['role'] = 'manager';
  let roleValid = false;
  while (!roleValid) {
    const roleChoice = await question('\nSelect role (1-7) [default: 1]: ');
    if (!roleChoice.trim()) {
      role = 'manager';
      roleValid = true;
    } else if (roleMap[roleChoice]) {
      role = roleMap[roleChoice];
      roleValid = true;
    } else {
      console.log('❌ Invalid choice! Please select 1-7.\n');
    }
  }

  // Get password
  let password = '';
  while (password.length < 6) {
    password = await question('Password (min 6 characters): ');
    if (password.length < 6) {
      console.log('❌ Password must be at least 6 characters!\n');
    }
  }

  // Confirm password
  let confirmPassword = '';
  while (confirmPassword !== password) {
    confirmPassword = await question('Confirm Password: ');
    if (confirmPassword !== password) {
      console.log('❌ Passwords do not match!\n');
    }
  }

  return {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    phone: phone.trim() || undefined,
    password,
    role,
  };
}

async function createSuperadmin(userInput: UserInput) {
  try {
    console.log('\n🔄 Creating user account...\n');

    // Step 1: Create auth user in Supabase Auth
    console.log('📝 Creating authentication account...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userInput.email,
      password: userInput.password,
      email_confirm: true,
      user_metadata: {
        full_name: userInput.fullName,
        phone: userInput.phone || null,
        role: userInput.role,
      },
    });

    if (authError) {
      throw new Error(`Auth error: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('Failed to create authentication account');
    }

    console.log('✅ Authentication account created');
    console.log(`   User ID: ${authData.user.id}`);

    // Step 2: Create user profile in database
    console.log('\n📝 Creating user profile in database...');
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        full_name: userInput.fullName,
        email: userInput.email,
        phone: userInput.phone || null,
        role: userInput.role,
        is_active: true,
      })
      .select()
      .single();

    if (profileError) {
      // If profile creation fails, try to clean up auth user
      console.error('\n❌ Failed to create user profile. Attempting cleanup...');
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Profile error: ${profileError.message}`);
    }

    console.log('✅ User profile created');

    // Success summary
    console.log('\n✨ Success! Superadmin user created:\n');
    console.log('┌──────────────────────────────────────────────────────┐');
    console.log(`│ Name:  ${userInput.fullName.padEnd(44)} │`);
    console.log(`│ Email: ${userInput.email.padEnd(44)} │`);
    if (userInput.phone) {
      console.log(`│ Phone: ${userInput.phone.padEnd(44)} │`);
    }
    console.log(`│ Role:  ${userInput.role.padEnd(44)} │`);
    console.log(`│ ID:    ${authData.user.id.padEnd(44)} │`);
    console.log('└──────────────────────────────────────────────────────┘');
    console.log('\n💡 User can now log in with their email and password.\n');

    return profileData;
  } catch (error) {
    console.error('\n❌ Error creating superadmin:', error instanceof Error ? error.message : error);
    throw error;
  }
}

async function main() {
  try {
    // Get user input
    const userInput = await getUserInput();

    // Confirm before creating
    console.log('\n📋 Review user details:\n');
    console.log(`  Name:  ${userInput.fullName}`);
    console.log(`  Email: ${userInput.email}`);
    if (userInput.phone) {
      console.log(`  Phone: ${userInput.phone}`);
    }
    console.log(`  Role:  ${userInput.role}`);

    const confirm = await question('\n✅ Create this user? (y/N): ');

    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled. No user was created.\n');
      rl.close();
      process.exit(0);
    }

    // Create the superadmin
    await createSuperadmin(userInput);

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Fatal error:', error instanceof Error ? error.message : error);
    rl.close();
    process.exit(1);
  }
}

// Run the script
main();
