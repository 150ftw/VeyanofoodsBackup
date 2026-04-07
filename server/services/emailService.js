// server/services/emailService.js
// Nodemailer transactional emails with Veyano brand styling
// Colors: #0A0A0A, #FF9900, #E5E4E2

const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ── HTML Email Base Template ──────────────────────────────────────────────────
function baseTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Veyano Foods</title>
</head>
<body style="margin:0;padding:0;background:#E5E4E2;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#E5E4E2;">
    <tr><td align="center" style="padding:30px 0;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        
        <!-- Header -->
        <tr><td style="background:#0A0A0A;padding:30px 40px;">
          <table width="100%">
            <tr>
              <td>
                <span style="font-size:26px;font-weight:bold;color:#FF9900;">VEYANO</span>
                <span style="font-size:16px;color:#E5E4E2;"> FOODS</span>
              </td>
            </tr>
            <tr><td style="padding-top:4px;">
              <span style="font-size:11px;color:#888888;">Thoughtfully Made for You</span>
            </td></tr>
          </table>
        </td></tr>
        
        <!-- Content -->
        <tr><td style="padding:40px;">${content}</td></tr>
        
        <!-- Footer -->
        <tr><td style="background:#0A0A0A;padding:20px 40px;text-align:center;">
          <p style="color:#888888;font-size:11px;margin:0 0 6px;">
            FSSAI License: 20826010000397 &nbsp;|&nbsp; veyanofoods@gmail.com
          </p>
          <p style="color:#555555;font-size:10px;margin:0;">
            © ${new Date().getFullYear()} Veyano Foods. All rights reserved.
          </p>
        </td></tr>
        
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Email Senders ─────────────────────────────────────────────────────────────

/**
 * Send order confirmation email with invoice attachment
 * @param {object} order
 * @param {string} invoicePath - Path to PDF file
 */
async function sendOrderConfirmation(order, invoicePath) {
  const content = `
    <h2 style="color:#0A0A0A;margin-top:0;">Order Confirmed! 🎉</h2>
    <p style="color:#444;line-height:1.6;">Hi <strong>${order.customerName}</strong>, your Veyano order has been confirmed.</p>
    
    <div style="background:#F9F9F9;border-left:4px solid #FF9900;padding:16px 20px;border-radius:4px;margin:24px 0;">
      <p style="margin:0 0 8px;"><strong>Order Number:</strong> ${order.orderNumber}</p>
      <p style="margin:0 0 8px;"><strong>Total Amount:</strong> ₹${order.totalAmount}${order.isCOD ? ' (COD — pay on delivery)' : ''}</p>
      <p style="margin:0 0 8px;"><strong>Payment:</strong> ${order.paymentMethod.toUpperCase()} — ${order.paymentStatus.toUpperCase()}</p>
      <p style="margin:0;"><strong>Delivery to:</strong> ${order.shippingAddress}, ${order.shippingPincode}</p>
    </div>
    
    ${order.isCOD ? `
    <div style="background:#FFF8E7;border:1px solid #FF9900;padding:12px 16px;border-radius:4px;margin-bottom:24px;">
      <p style="margin:0;color:#886600;font-size:13px;">
        <strong>📞 COD Note:</strong> Our team will call you to confirm your order before dispatch. Please keep your phone available.
      </p>
    </div>` : ''}
    
    <p style="color:#444;line-height:1.6;">Your GST invoice is attached to this email. We'll send you tracking details once your order is shipped.</p>
    <p style="color:#444;line-height:1.6;">Thank you for choosing <strong style="color:#FF9900;">Veyano</strong>! 🙏</p>
  `;

  await transporter.sendMail({
    from: `"Veyano Foods" <${process.env.EMAIL_USER}>`,
    to: order.customerEmail,
    subject: `✅ Order Confirmed — ${order.orderNumber} | Veyano Foods`,
    html: baseTemplate(content, `Your order ${order.orderNumber} has been confirmed`),
    attachments: invoicePath ? [{
      filename: `Invoice-${order.orderNumber}.pdf`,
      path: invoicePath,
      contentType: 'application/pdf',
    }] : [],
  });
}

/**
 * Send COD phone confirmation reminder to admin
 * @param {object} order
 */
async function sendCODAdminAlert(order) {
  const content = `
    <h2 style="color:#0A0A0A;margin-top:0;">⚠️ COD Order — Phone Confirmation Required</h2>
    <p style="color:#444;">A new COD order requires a phone confirmation call before it can be packed.</p>
    
    <div style="background:#FFF8E7;border:1px solid #FF9900;padding:16px 20px;border-radius:4px;margin:24px 0;">
      <p style="margin:0 0 8px;"><strong>Order:</strong> ${order.orderNumber}</p>
      <p style="margin:0 0 8px;"><strong>Customer:</strong> ${order.customerName}</p>
      <p style="margin:0 0 8px;"><strong>📞 Phone:</strong> <a href="tel:${order.customerPhone}" style="color:#FF9900;font-size:18px;font-weight:bold;">${order.customerPhone}</a></p>
      <p style="margin:0 0 8px;"><strong>Amount:</strong> ₹${order.totalAmount} (COD)</p>
      <p style="margin:0;"><strong>Address:</strong> ${order.shippingAddress}, ${order.shippingPincode}</p>
    </div>
    
    <p style="color:#666;font-size:12px;">Log in to the admin panel to mark as confirmed after the call.</p>
  `;

  await transporter.sendMail({
    from: `"Veyano System" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `📞 COD Confirmation Needed — ${order.orderNumber}`,
    html: baseTemplate(content, 'COD order needs phone call'),
  });
}

/**
 * Send shipping notification to customer
 * @param {object} order
 */
async function sendShippingNotification(order) {
  const content = `
    <h2 style="color:#0A0A0A;margin-top:0;">Your Order is on the Way! 🚀</h2>
    <p style="color:#444;line-height:1.6;">Hi <strong>${order.customerName}</strong>, your Veyano order has been shipped!</p>
    
    <div style="background:#F0FFF4;border-left:4px solid #22C55E;padding:16px 20px;border-radius:4px;margin:24px 0;">
      <p style="margin:0 0 8px;"><strong>Order:</strong> ${order.orderNumber}</p>
      <p style="margin:0 0 8px;"><strong>Courier:</strong> ${order.courierName || 'Our Courier Partner'}</p>
      <p style="margin:0;"><strong>AWB / Tracking No:</strong> <span style="color:#FF9900;font-weight:bold;font-size:16px;">${order.awbCode}</span></p>
    </div>
    
    <p style="color:#444;line-height:1.6;">Keep an eye on your package! It should arrive in 3-7 business days.</p>
  `;

  await transporter.sendMail({
    from: `"Veyano Foods" <${process.env.EMAIL_USER}>`,
    to: order.customerEmail,
    subject: `🚀 Order Shipped — ${order.orderNumber} | AWB: ${order.awbCode}`,
    html: baseTemplate(content, `Your order ${order.orderNumber} is on its way!`),
  });
}

/**
 * Send low stock alert to admin
 * @param {Array} lowStockItems
 */
async function sendLowStockAlert(lowStockItems) {
  const rows = lowStockItems.map(item => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #eee;">${item.sku}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${item.productName}</td>
      <td style="padding:10px;border-bottom:1px solid #eee;color:${item.quantityUnits === 0 ? '#DC2626' : '#D97706'};font-weight:bold;">${item.quantityUnits} units</td>
      <td style="padding:10px;border-bottom:1px solid #eee;">${item.status.toUpperCase()}</td>
    </tr>
  `).join('');

  const content = `
    <h2 style="color:#0A0A0A;margin-top:0;">⚠️ Low Stock Alert</h2>
    <p style="color:#444;">The following SKUs need immediate restocking:</p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden;">
      <tr style="background:#0A0A0A;">
        <th style="padding:10px;text-align:left;color:#FF9900;font-size:12px;">SKU</th>
        <th style="padding:10px;text-align:left;color:#FF9900;font-size:12px;">Product</th>
        <th style="padding:10px;text-align:left;color:#FF9900;font-size:12px;">Qty Remaining</th>
        <th style="padding:10px;text-align:left;color:#FF9900;font-size:12px;">Status</th>
      </tr>
      ${rows}
    </table>
    
    <p style="color:#666;font-size:12px;margin-top:20px;">Log in to the admin panel to update inventory.</p>
  `;

  await transporter.sendMail({
    from: `"Veyano System" <${process.env.EMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `⚠️ Low Stock Alert — ${lowStockItems.length} SKU(s) Need Restocking`,
    html: baseTemplate(content, 'Low stock detected — action required'),
  });
}

module.exports = { sendOrderConfirmation, sendCODAdminAlert, sendShippingNotification, sendLowStockAlert };
