// server/services/codService.js
// COD (Cash on Delivery) Logic Module
// Automatically flags COD orders, adds ₹99 surcharge, queues phone confirmation

const COD_SURCHARGE = 99; // ₹

/**
 * Apply COD rules to an incoming order payload
 * @param {object} orderData - Raw order from API request
 * @returns {object} Modified order with COD surcharge and flags
 */
function applyCODLogic(orderData) {
  if (orderData.paymentMethod !== 'cod') {
    return {
      ...orderData,
      isCOD: false,
      codFlagConfirmed: false,
      shippingFee: orderData.subtotalAmount >= 499 ? 0 : 50,
    };
  }

  const shippingFee = COD_SURCHARGE; // COD always pays ₹99
  const totalAmount = orderData.subtotalAmount + shippingFee - (orderData.discountAmount || 0);

  return {
    ...orderData,
    isCOD: true,
    codFlagConfirmed: false,           // Must be confirmed via phone call
    paymentStatus: 'pending',          // Payment is not collected yet
    status: 'pending',                 // Hold until phone confirmation
    shippingFee,
    totalAmount,
  };
}

/**
 * Check if a COD order is ready for dispatch (phone confirmed)
 * @param {object} order - Order model instance
 * @returns {{ready: boolean, reason?: string}}
 */
function isCODReadyForDispatch(order) {
  if (!order.isCOD) return { ready: true };
  if (!order.codFlagConfirmed) {
    return {
      ready: false,
      reason: 'COD order requires phone confirmation before dispatch. Please call customer and mark as confirmed.',
    };
  }
  return { ready: true };
}

/**
 * Get summary of pending COD confirmations
 */
function getPendingCODMessage(count) {
  return `⚠️ ${count} COD order(s) awaiting phone confirmation. Please call customers before packing.`;
}

module.exports = { applyCODLogic, isCODReadyForDispatch, COD_SURCHARGE, getPendingCODMessage };
