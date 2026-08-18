const express = require("express");
const {
  createBatch,
  getBatches,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
  updateBatchStatus,
  getBatchDashboardStats,
} = require("../controllers/batchController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// Public: Used by Registration page
router.get("/active-registration", getActiveRegistrationBatch);

// Admin: Get batch dashboard statistics
router.get("/stats", protect, authorize("admin"), getBatchDashboardStats);

// Admin: Get list of all batches
router.get("/", protect, authorize("admin"), getBatches);

// Admin: Create new batch
router.post("/", protect, authorize("admin"), createBatch);

// Admin: Toggle registration ON / OFF
router.patch(
  "/:id/toggle-registration",
  protect,
  authorize("admin"),
  toggleBatchRegistration,
);

// Admin: Update batch status
router.patch("/:id/status", protect, authorize("admin"), updateBatchStatus);

module.exports = router;
