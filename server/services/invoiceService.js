// server/services/invoiceService.js
// GST-compliant PDF invoice generator using PDFKit
// FSSAI ID: 20826010000397
// Color Scheme: #0A0A0A (Obsidian), #FF9900 (Electric Saffron), #E5E4E2 (Frosted Silver)

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Colors
const OBSIDIAN = '#0A0A0A';
const SAFFRON = '#FF9900';
const SILVER = '#E5E4E2';
const WHITE = '#FFFFFF';

// GST rate for food products
const GST_RATE = 0.05; // 5%
const FSSAI_ID = '20826010000397';

/**
 * Generate a GST-compliant PDF invoice for an order
 * @param {object} order - Order model instance with items
 * @param {Array} items - OrderItem instances
 * @returns {string} Path to generated PDF
 */
async function generateInvoice(order, items) {
  const invoiceDir = path.join(__dirname, '..', 'invoices');
  if (!fs.existsSync(invoiceDir)) fs.mkdirSync(invoiceDir, { recursive: true });

  const invoicePath = path.join(invoiceDir, `INV-${order.orderNumber}.pdf`);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    // ── HEADER BAND ───────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(OBSIDIAN);

    doc.fontSize(28).fillColor(SAFFRON).font('Helvetica-Bold')
      .text('VEYANO', 50, 30, { continued: true })
      .fillColor(WHITE).font('Helvetica')
      .fontSize(12).text(' FOODS', { continued: false });

    doc.fontSize(9).fillColor(SILVER)
      .text('Thoughtfully Made for You', 50, 65)
      .text(`FSSAI License No: ${FSSAI_ID}`, 50, 80)
      .text('veyanofoods@gmail.com  |  Instagram: @veyanofoods', 50, 95);

    // Invoice Title (right side of header)
    doc.fontSize(20).fillColor(SAFFRON).font('Helvetica-Bold')
      .text('TAX INVOICE', 350, 35, { align: 'right' });
    doc.fontSize(9).fillColor(SILVER).font('Helvetica')
      .text(`Invoice No: INV-${order.orderNumber}`, 350, 65, { align: 'right' })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 80, { align: 'right' })
      .text(`Order ID: ${order.id.slice(0, 8).toUpperCase()}`, 350, 95, { align: 'right' });

    // ── DIVIDER ───────────────────────────────────────────────────────────
    doc.moveDown(5);

    // ── BILLING INFO ──────────────────────────────────────────────────────
    const infoY = 140;
    doc.fontSize(10).fillColor(OBSIDIAN).font('Helvetica-Bold').text('BILL TO:', 50, infoY);
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(order.customerName, 50, infoY + 15)
      .text(`Phone: ${order.customerPhone}`, 50, infoY + 28)
      .text(`Email: ${order.customerEmail || 'N/A'}`, 50, infoY + 41)
      .text(order.shippingAddress, 50, infoY + 54, { width: 200 })
      .text(`${order.shippingCity || ''}, ${order.shippingState || ''} - ${order.shippingPincode}`, 50, infoY + 80);

    // Payment info (right)
    doc.fontSize(10).fillColor(OBSIDIAN).font('Helvetica-Bold').text('PAYMENT INFO:', 350, infoY);
    doc.font('Helvetica').fontSize(9).fillColor('#333333')
      .text(`Method: ${order.paymentMethod.toUpperCase()}`, 350, infoY + 15)
      .text(`Status: ${order.paymentStatus.toUpperCase()}`, 350, infoY + 28)
      .text(`Source: ${order.source.toUpperCase()}`, 350, infoY + 41);
    if (order.razorpayPaymentId) {
      doc.text(`Razorpay ID: ${order.razorpayPaymentId}`, 350, infoY + 54);
    }

    // ── ITEMS TABLE ───────────────────────────────────────────────────────
    const tableTop = 270;
    const tableHeaders = ['#', 'Product', 'SKU', 'Qty', 'Unit Price', 'Total'];
    const colWidths = [25, 175, 90, 40, 80, 80];
    const colX = [50, 75, 250, 340, 380, 460];

    // Table header
    doc.rect(50, tableTop, 500, 22).fill(OBSIDIAN);
    doc.fillColor(SAFFRON).fontSize(9).font('Helvetica-Bold');
    tableHeaders.forEach((h, i) => {
      doc.text(h, colX[i], tableTop + 6, { width: colWidths[i] });
    });

    // Table rows
    let rowY = tableTop + 22;
    doc.font('Helvetica').fontSize(9).fillColor(OBSIDIAN);

    items.forEach((item, index) => {
      const bg = index % 2 === 0 ? '#FAFAFA' : WHITE;
      doc.rect(50, rowY, 500, 22).fill(bg);
      doc.fillColor(OBSIDIAN)
        .text(String(index + 1), colX[0], rowY + 6, { width: colWidths[0] })
        .text(item.productName, colX[1], rowY + 6, { width: colWidths[1] })
        .text(item.sku, colX[2], rowY + 6, { width: colWidths[2] })
        .text(String(item.quantity), colX[3], rowY + 6, { width: colWidths[3] })
        .text(`₹${item.unitPrice}`, colX[4], rowY + 6, { width: colWidths[4] })
        .text(`₹${item.totalPrice}`, colX[5], rowY + 6, { width: colWidths[5] });
      rowY += 22;
    });

    // ── TOTALS ─────────────────────────────────────────────────────────────
    const totalX = 350;
    let totalY = rowY + 15;

    const lineTotal = (label, value, bold = false, highlight = false) => {
      if (bold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fontSize(9).fillColor(highlight ? SAFFRON : OBSIDIAN)
        .text(label, totalX, totalY)
        .text(value, 460, totalY, { width: 90, align: 'right' });
      totalY += 16;
    };

    lineTotal('Subtotal:', `₹${order.subtotalAmount}`);
    lineTotal('GST (5% on food):', `₹${order.gstAmount || 0}`);
    lineTotal(`Shipping Fee:`, order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee}`);
    if (order.discountAmount > 0) lineTotal('Discount:', `-₹${order.discountAmount}`);

    // Total divider line
    doc.moveTo(totalX, totalY + 2).lineTo(550, totalY + 2).strokeColor(SAFFRON).lineWidth(1.5).stroke();
    totalY += 8;
    lineTotal('TOTAL AMOUNT:', `₹${order.totalAmount}`, true, true);

    // ── BATCH TRACEABILITY ─────────────────────────────────────────────────
    if (order.batchId) {
      totalY += 20;
      doc.fontSize(8).fillColor('#666666').font('Helvetica')
        .text(`Production Batch Reference: ${order.batchId}`, 50, totalY);
    }

    // ── FOOTER ─────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(OBSIDIAN);
    doc.fontSize(8).fillColor(SILVER).font('Helvetica')
      .text('This is a computer-generated invoice. No signature required.', 50, footerY + 15, { align: 'center', width: 495 })
      .text(`FSSAI License: ${FSSAI_ID}  |  All prices inclusive of applicable taxes`, 50, footerY + 32, { align: 'center', width: 495 })
      .text('Thank you for choosing Veyano — Thoughtfully Made for You', 50, footerY + 50, { align: 'center', width: 495 });
    doc.fillColor(SAFFRON).text('veyanofoods@gmail.com', 50, footerY + 65, { align: 'center', width: 495 });

    doc.end();

    stream.on('finish', () => resolve(invoicePath));
    stream.on('error', reject);
  });
}

module.exports = { generateInvoice };
