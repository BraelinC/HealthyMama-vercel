import { db } from './server/db.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function findUser() {
  try {
    console.log('🔍 Searching for user: braelincarranza@gmail.com');

    // First, let's see all users
    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      full_name: users.full_name,
      createdAt: users.createdAt
    }).from(users);

    console.log(`📊 Total users in database: ${allUsers.length}`);

    // Look for your specific email
    const targetUser = allUsers.find(u => u.email === 'braelincarranza@gmail.com');

    if (targetUser) {
      console.log('✅ Found your account!');
      console.log('User ID:', targetUser.id);
      console.log('Email:', targetUser.email);
      console.log('Full Name:', targetUser.full_name);
      console.log('Created:', targetUser.createdAt);
    } else {
      console.log('❌ Account not found with email: braelincarranza@gmail.com');
      console.log('\n📋 All users in database:');
      allUsers.forEach((u, i) => {
        console.log(`  ${i + 1}. ID: ${u.id}`);
        console.log(`     Email: ${u.email}`);
        console.log(`     Name: ${u.full_name || 'No name'}`);
        console.log(`     Created: ${u.createdAt}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
  } finally {
    process.exit(0);
  }
}

findUser();