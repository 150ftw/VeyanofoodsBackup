// server/routes/inventory.js — Raw materials & finished goods management

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const RawMaterial = require('../models/RawMaterial');
const FinishedGood = require('../models/FinishedGood');
const Batch = require('../models/Batch');
const { getLowStockAlerts, getTotalStock } = require('../services/fefoService');
const { sendLowStockAlert } = require('../services/emailService');
const { Op } = require('sequelize');

// All inventory routes require authentication
router.use(authMiddleware);

// ── RAW MATERIALS ─────────────────────────────────────────────────────────────

/** GET /api/inventory/raw — List all raw materials (FEFO sorted) */
router.get('/raw', async (req, res, next) => {
  try {
    const { status, name } = req.query;
    const where = {};
    if (status) where.status = status;
    if (name) where.name = { [Op.like]: `%${name}%` };

    const materials = await RawMaterial.findAll({
      where,
      order: [['expiryDate', 'ASC'], ['createdAt', 'DESC']],
    });
    res.json({ count: materials.length, data: materials });
  } catch (err) { next(err); }
});

/** POST /api/inventory/raw — Add a new raw material batch */
router.post('/raw', async (req, res, next) => {
  try {
    const { name, batchCode, supplierName, quantityKg, unitCostPerKg, purchaseDate, expiryDate, storageLocation, notes } = req.body;

    if (!name || !batchCode || !quantityKg || !expiryDate) {
      return res.status(400).json({ error: 'name, batchCode, quantityKg, and expiryDate are required.' });
    }

    const material = await RawMaterial.create({
      name, batchCode, supplierName, quantityKg, unitCostPerKg,
      purchaseDate: purchaseDate || new Date(),
      expiryDate, storageLocation, notes,
    });

    res.status(201).json({ message: 'Raw material batch added.', data: material });
  } catch (err) { next(err); }
});

/** PATCH /api/inventory/raw/:id — Update quantity or status */
router.patch('/raw/:id', async (req, res, next) => {
  try {
    const material = await RawMaterial.findByPk(req.params.id);
    if (!material) return res.status(404).json({ error: 'Raw material not found.' });

    await material.update(req.body);
    res.json({ message: 'Updated.', data: material });
  } catch (err) { next(err); }
});

// ── FINISHED GOODS ────────────────────────────────────────────────────────────

/** GET /api/inventory/finished — List all finished goods (FEFO sorted) */
router.get('/finished', async (req, res, next) => {
  try {
    const { sku, status } = req.query;
    const where = {};
    if (sku) where.sku = sku;
    if (status) where.status = status;

    const goods = await FinishedGood.findAll({
      where,
      order: [['expiryDate', 'ASC']],
      include: [{ model: Batch, as: 'batch' }],
    });
    res.json({ count: goods.length, data: goods });
  } catch (err) { next(err); }
});

/** GET /api/inventory/finished/stock/:sku — Get total available stock for a SKU */
router.get('/finished/stock/:sku', async (req, res, next) => {
  try {
    const totalUnits = await getTotalStock(req.params.sku.toUpperCase());
    res.json({ sku: req.params.sku.toUpperCase(), totalUnits });
  } catch (err) { next(err); }
});

/** POST /api/inventory/finished — Add a new finished goods batch */
router.post('/finished', async (req, res, next) => {
  try {
    const { sku, productName, batchId, batchCode, quantityUnits, mrpPaise, expiryDate, warehouseLocation } = req.body;

    if (!sku || !productName || !batchId || !batchCode || !quantityUnits || !mrpPaise || !expiryDate) {
      return res.status(400).json({ error: 'Missing required fields: sku, productName, batchId, batchCode, quantityUnits, mrpPaise, expiryDate.' });
    }

    const good = await FinishedGood.create({
      sku: sku.toUpperCase(), productName, batchId, batchCode,
      quantityUnits, mrpPaise, expiryDate, warehouseLocation,
    });

    res.status(201).json({ message: 'Finished goods batch added.', data: good });
  } catch (err) { next(err); }
});

// ── BATCHES ───────────────────────────────────────────────────────────────────

/** GET /api/inventory/batches — List all production batches */
router.get('/batches', async (req, res, next) => {
  try {
    const batches = await Batch.findAll({ order: [['productionDate', 'DESC']] });
    res.json({ count: batches.length, data: batches });
  } catch (err) { next(err); }
});

/** POST /api/inventory/batches — Create a new production batch */
router.post('/batches', async (req, res, next) => {
  try {
    const { batchCode, sku, productionDate, expiryDate, quantityProduced, rawMaterialBatchCodes, notes } = req.body;

    if (!batchCode || !sku || !productionDate || !expiryDate || !quantityProduced) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const batch = await Batch.create({
      batchCode, sku: sku.toUpperCase(), productionDate, expiryDate,
      quantityProduced, quantityRemaining: quantityProduced,
      rawMaterialBatchCodes: rawMaterialBatchCodes || [],
      notes,
    });

    res.status(201).json({ message: 'Production batch created.', data: batch });
  } catch (err) { next(err); }
});

// ── ALERTS ────────────────────────────────────────────────────────────────────

/** GET /api/inventory/alerts — Low stock and expiry alerts */
router.get('/alerts', async (req, res, next) => {
  try {
    const lowStock = await getLowStockAlerts();

    // Also check for raw materials expiring in 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoon = await RawMaterial.findAll({
      where: {
        expiryDate: { [Op.lte]: thirtyDaysFromNow },
        status: { [Op.ne]: 'depleted' },
      },
      order: [['expiryDate', 'ASC']],
    });

    // Optionally send email if critical items
    if (req.query.notify === 'true' && lowStock.length > 0) {
      await sendLowStockAlert(lowStock);
    }

    res.json({
      lowStockFinishedGoods: { count: lowStock.length, data: lowStock },
      rawMaterialsExpiringSoon: { count: expiringSoon.length, data: expiringSoon },
    });
  } catch (err) { next(err); }
});

module.exports = router;
