// server/config/clerk.js
const { createClerkClient } = require('@clerk/backend');
require('dotenv').config();

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

module.exports = clerkClient;
