// server/services/fefoService.js
const supabase = require('../config/supabase');

const LOW_STOCK_THRESHOLD = 50; 

/**
 * Get the earliest-expiring available batch for a given SKU (FEFO order)
 */
async function getNextBatch(sku) {
  const { data: batches, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .gt('stock_quantity', 0)
    .order('created_at', { ascending: true }) // Using created_at as a proxy for batch order if expiry is not in the row
    .limit(1);

  if (error || !batches || batches.length === 0) return null;
  return batches[0];
}

/**
 * Deduct stock from products for a given SKU
 */
async function deductStock(sku, requiredQty) {
  // Check available stock
  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single();

  if (fetchError || !product) {
    throw new Error(`Product mapping not found for SKU: ${sku}`);
  }

  if (product.stock_quantity < requiredQty) {
    throw new Error(`Insufficient stock for SKU: ${sku}. Available: ${product.stock_quantity}, Required: ${requiredQty}`);
  }

  const newQty = product.stock_quantity - requiredQty;
  
  const { error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newQty })
    .eq('sku', sku);

  if (updateError) throw updateError;

  return [{ batchCode: 'SUPABASE_MANAGED', quantityDeducted: requiredQty }];
}

/**
 * Get all SKUs with stock below LOW_STOCK_THRESHOLD
 */
async function getLowStockAlerts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .lt('stock_quantity', LOW_STOCK_THRESHOLD);
  
  if (error) return [];
  return data;
}

/**
 * Check total available stock for a SKU
 */
async function getTotalStock(sku) {
  const { data, error } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('sku', sku)
    .single();

  if (error || !data) return 0;
  return data.stock_quantity;
}

module.exports = { getNextBatch, deductStock, getLowStockAlerts, getTotalStock };
