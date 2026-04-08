// server/scripts/test_whatsapp.js
const { sendWhatsAppMessage } = require('../services/whatsappService');
require('dotenv').config();

async function test() {
  const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
  
  if (!adminNumber) {
    console.error('❌ Please set ADMIN_WHATSAPP_NUMBER in your .env file first!');
    process.exit(1);
  }

  console.log(`🚀 Sending test message to ${adminNumber}...`);
  
  try {
    await sendWhatsAppMessage(adminNumber, 'Hello! This is a test message from your Veyano Foods WhatsApp Bot. 🌾🛍️');
    console.log('✅ Test message sent successfully!');
  } catch (err) {
    console.error('❌ Test failed. Check your WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
  }
}

test();
