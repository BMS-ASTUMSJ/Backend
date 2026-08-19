const express = require("express");

const router = express.Router();

const {
  createBatch,
  getBatches,
  getBatchStats,
  getBatchById,
  updateBatch,
} = require("../controllers/batchController");

const protect = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

// ======================================================
// BATCH ROUTES
// ======================================================

// Get batch statistics
// Must be before /:id
router.get(
  "/stats",
  protect,
  getBatchStats
);

// Get all batches
router.get(
  "/",
  protect,
  getBatches
);

// Get one batch
router.get(
  "/:id",
  protect,
  getBatchById
);

// Create batch - ADMIN ONLY
router.post(
  "/",
  protect,
  roleMiddleware("admin"),
  createBatch
);

// Update batch - ADMIN ONLY
router.patch(
  "/:id",
  protect,
  roleMiddleware("admin"),
  updateBatch
);

module.exports = router;