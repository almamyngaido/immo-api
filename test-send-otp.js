// Test the send-user-otp endpoint
require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = 'http://127.0.0.1:3000';

async function testSendOtp() {
  console.log('🧪 Testing Send OTP Endpoint...\n');

  try {
    // Step 1: Login as admin to get token
    console.log('Step 1: Logging in as admin...');
    const loginResponse = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: 'almamyngaido@gmail.com',
        type: 'email',
        motDePasse: 'your-admin-password-here', // UPDATE THIS
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${error}`);
    }

    const {token} = await loginResponse.json();
    console.log('✅ Login successful');
    console.log('  Token:', token.substring(0, 20) + '...\n');

    // Step 2: Get list of unverified users
    console.log('Step 2: Getting unverified users...');
    const usersResponse = await fetch(`${API_URL}/utilisateurs/inactif`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!usersResponse.ok) {
      const error = await usersResponse.text();
      throw new Error(`Get users failed: ${usersResponse.status} - ${error}`);
    }

    const users = await usersResponse.json();
    console.log(`✅ Found ${users.length} unverified users`);

    if (users.length === 0) {
      console.log('⚠️ No unverified users to test with');
      return;
    }

    const testUser = users[0];
    console.log('  Test user:', testUser.email, '\n');

    // Step 3: Send OTP to user
    console.log('Step 3: Sending OTP to user...');
    console.log('  Request:', {
      userId: testUser.id,
      email: testUser.email,
    });

    const otpResponse = await fetch(`${API_URL}/send-user-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userId: testUser.id,
        email: testUser.email,
      }),
    });

    console.log('  Response status:', otpResponse.status);
    const responseText = await otpResponse.text();
    console.log('  Response body:', responseText);

    if (!otpResponse.ok) {
      throw new Error(`Send OTP failed: ${otpResponse.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('\n✅ OTP sent successfully!');
    console.log('  Result:', result);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('  Full error:', error);
    process.exit(1);
  }
}

testSendOtp();
