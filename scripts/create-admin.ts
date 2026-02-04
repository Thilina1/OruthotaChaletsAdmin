// This script is not part of the app runtime and should be run manually from the command line.
// e.g., npx tsx scripts/create-admin.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
    process.exit(1);
}

// Create Supabase client with Service Role Key (Admin privileges)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const usersToCreate = [
    {
        name: 'Admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
    },
    {
        name: 'Waiter',
        email: 'waiter@example.com',
        password: 'waiter123',
        role: 'waiter',
    },
    {
        name: 'Payment',
        email: 'payment@example.com',
        password: 'payment123',
        role: 'payment',
    },
];

const createUsers = async () => {
    for (const user of usersToCreate) {
        try {
            console.log(`Creating user: ${user.email}...`);

            // 1. Create User in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: user.email,
                password: user.password,
                email_confirm: true, // Auto confirm email
            });

            if (authError) {
                console.error(`Error creating auth user ${user.email}:`, authError.message);
                continue;
            }

            if (!authData.user) {
                console.error(`No user returned for ${user.email}`);
                continue;
            }

            const uid = authData.user.id;

            // 2. Create User Record in 'users' table
            // We use upsert to avoid duplicate key errors if we run this multiple times
            // and the auth user was recreated but the table row persisted (or vice versa handled by RLS/logic)
            const { error: dbError } = await supabase
                .from('users')
                .upsert({
                    id: uid, // Link by ID
                    email: user.email,
                    name: user.name,
                    role: user.role,
                });

            if (dbError) {
                console.error(`Error creating DB record for ${user.email}:`, dbError.message);
            } else {
                console.log(`Successfully created user: ${user.email} with role: ${user.role}`);
            }

        } catch (error) {
            console.error(`Unexpected error creating user: ${user.name}`, error);
        }
    }
};

createUsers().then(() => {
    console.log('Finished creating users.');
    process.exit(0);
});
