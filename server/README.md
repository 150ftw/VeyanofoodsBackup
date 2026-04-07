# Veyano Foods Backend — Setup Guide

## Prerequisites
Install Node.js 18+ from https://nodejs.org (LTS version)

## 1. Install Dependencies
```powershell
cd c:\Users\Kesha\Downloads\trial\server
npm install
```

## 2. Configure Environment
```powershell
copy .env.example .env
```
Then open `.env` and fill in:
- `JWT_SECRET` — any long random string
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — from your Razorpay Dashboard
- `RAZORPAY_WEBHOOK_SECRET` — set in Razorpay Dashboard > Webhooks
- `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` — your Shiprocket account
- `EMAIL_USER` / `EMAIL_PASS` — Gmail App Password (not your regular Gmail password)
- `AWS_*` — your S3 credentials (optional, backups won't run without this)

## 3. Create Admin Account (one-time)
```powershell
npm run dev
```
Then call the setup endpoint (use Postman, Thunder Client, or curl):
```powershell
Invoke-WebRequest -Uri "http://localhost:3001/api/auth/setup" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Kesha","email":"veyanofoods@gmail.com","password":"YourPassword123"}'
```
Save the returned `token` — you'll use it for all admin API calls.

## 4. Run the Server
```powershell
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

## 5. Verify It's Running
Open in browser: http://localhost:3001/health

## API Endpoints Quick Reference

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /api/auth/setup | One-time admin setup | ❌ |
| POST | /api/auth/login | Login → get JWT | ❌ |
| POST | /api/orders | Create order (frontend uses this) | ❌ |
| GET | /api/orders | List all orders | ✅ |
| PATCH | /api/orders/:id/status | Update order status | ✅ |
| PATCH | /api/orders/:id/confirm-cod | Confirm COD via phone | ✅ |
| GET | /api/inventory/raw | Raw material batches | ✅ |
| POST | /api/inventory/raw | Add raw material batch | ✅ |
| GET | /api/inventory/finished | Finished goods stock | ✅ |
| GET | /api/inventory/alerts | Low stock + expiry alerts | ✅ |
| POST | /api/logistics/ship/:orderId | Create Shiprocket shipment | ✅ |
| GET | /api/logistics/label/:orderId | Get shipping label | ✅ |
| GET | /api/compliance/invoice/:orderId | Download PDF invoice | ✅ |
| GET | /api/compliance/batch/:batchId | Batch traceability | ✅ |
| POST | /api/webhook/razorpay | Razorpay payment events | 🔑 HMAC |

## 6. Connect Razorpay Webhook
In Razorpay Dashboard → Settings → Webhooks:
- URL: `https://your-domain.com/api/webhook/razorpay`
- Events: `payment.captured`, `payment.failed`, `refund.created`
- Copy the webhook secret → paste into `.env` as `RAZORPAY_WEBHOOK_SECRET`

## 7. Run Tests
```powershell
npm test
```

## Gmail App Password Setup
1. Go to Google Account → Security → 2-Step Verification (enable it)
2. Search "App Passwords" in Google Account
3. Create an app password for "Mail"
4. Use that 16-character password in `.env` as `EMAIL_PASS`
