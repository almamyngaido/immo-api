// Create a test unverified user
require('dotenv').config();
const fetch = require('node-fetch');

const API_URL = 'http://127.0.0.1:3000';

async function createTestUser() {
  console.log('🧪 Creating test unverified user...\n');

  const testUser = {
    nom: 'Test',
    prenom: 'User',
    email: 'testuser@example.com',
    phoneNumber: '+33612345678',
    motDePasse: 'TestPassword123',
    role: 'agent',
    dateInscription: new Date().toISOString().split('T')[0],
  };

  try {
    console.log('📤 Registering new user via /signup...');
    console.log('  Email:', testUser.email);
    console.log('  Phone:', testUser.phoneNumber);
    console.log('  Role:', testUser.role);

    const response = await fetch(`${API_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testUser),
    });

    const responseText = await response.text();
    console.log('  Response status:', response.status);
    console.log('  Response body:', responseText);

    if (!response.ok) {
      if (response.status === 409) {
        console.log('\n⚠️ User already exists! Let me check if they are verified...\n');

        // Get the user
        const usersResponse = await fetch(`${API_URL}/utilisateurs/inactif`);
        const users = await usersResponse.json();
        const existingUser = users.find(u => u.email === testUser.email);

        if (existingUser) {
          console.log('✅ Found existing UNVERIFIED user:');
          console.log('  ID:', existingUser.id);
          console.log('  Name:', existingUser.prenom, existingUser.nom);
          console.log('  Email:', existingUser.email);
          console.log('  Verified:', existingUser.verified);
          console.log('\n👉 You can use this user to test admin approval!');
        } else {
          console.log('❌ User exists but is already verified. Please try with a different email.');
        }
        return;
      }
      throw new Error(`Failed to create user: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    console.log('\n✅ Test user created successfully!');
    console.log('  ID:', result.id);
    console.log('  Name:', result.prenom, result.nom);
    console.log('  Email:', result.email);
    console.log('  Verified:', result.verified);
    console.log('\n👉 Now go to your Flutter app admin panel and approve this user!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('  Full error:', error);
    process.exit(1);
  }
}

createTestUser();
