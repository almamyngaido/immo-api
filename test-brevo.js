// Test Brevo email configuration
require('dotenv').config();
const brevo = require('@getbrevo/brevo');

console.log('🧪 Testing Brevo Configuration...\n');

// Check environment variables
console.log('Environment Variables:');
console.log('  BREVO_API_KEY:', process.env.BREVO_API_KEY ? '✅ Set (' + process.env.BREVO_API_KEY.substring(0, 10) + '...)' : '❌ Not set');
console.log('  BREVO_SENDER_EMAIL:', process.env.BREVO_SENDER_EMAIL || '❌ Not set');
console.log('  BREVO_SENDER_NAME:', process.env.BREVO_SENDER_NAME || 'Maxiim (default)');
console.log('');

if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) {
  console.error('❌ Missing required environment variables!');
  console.error('Please set BREVO_API_KEY and BREVO_SENDER_EMAIL in .env file');
  process.exit(1);
}

// Test API connection
async function testBrevoAPI() {
  try {
    console.log('📡 Testing Brevo API connection...\n');

    const apiInstance = new brevo.TransactionalEmailsApi();
    apiInstance.setApiKey(
      brevo.TransactionalEmailsApiApiKeys.apiKey,
      process.env.BREVO_API_KEY
    );

    const sendSmtpEmail = new brevo.SendSmtpEmail();
    sendSmtpEmail.sender = {
      name: process.env.BREVO_SENDER_NAME || 'Maxiim',
      email: process.env.BREVO_SENDER_EMAIL,
    };
    sendSmtpEmail.to = [{email: process.env.BREVO_SENDER_EMAIL}]; // Send to self for testing
    sendSmtpEmail.subject = 'Test Email from Maxiim';
    sendSmtpEmail.htmlContent = `
      <html>
        <body>
          <h1>Test Email</h1>
          <p>This is a test email from the Maxiim backend to verify Brevo configuration.</p>
          <p><strong>If you received this, Brevo is working correctly!</strong></p>
        </body>
      </html>
    `;

    console.log('📤 Sending test email...');
    console.log('  From:', `${sendSmtpEmail.sender.name} <${sendSmtpEmail.sender.email}>`);
    console.log('  To:', sendSmtpEmail.to[0].email);
    console.log('  Subject:', sendSmtpEmail.subject);
    console.log('');

    const result = await apiInstance.sendTransacEmail(sendSmtpEmail);

    console.log('✅ SUCCESS! Email sent via Brevo!');
    console.log('  Message ID:', result.body.messageId);
    console.log('');
    console.log('✅ Brevo configuration is working correctly!');
    console.log('  Check your inbox at:', process.env.BREVO_SENDER_EMAIL);
  } catch (error) {
    console.error('❌ FAILED to send email via Brevo!');
    console.error('');
    console.error('Error message:', error.message);
    if (error.response) {
      console.error('Status code:', error.response.status);
      console.error('Response body:', error.response.body);
    }
    console.error('');
    console.error('Common issues:');
    console.error('  - Invalid API key');
    console.error('  - Sender email not verified in Brevo account');
    console.error('  - API key doesn\'t have permission to send emails');
    console.error('');
    process.exit(1);
  }
}

testBrevoAPI();
