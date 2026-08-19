const express = require("express");

const {
  createBatch,
  getBatches,
  getMyBatches,
  getMyBatch,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
  updateBatchStatus,
  getBatchDashboardStats,
  getBatchStats,
  getBatchById,
  updateBatch,
} = require("../controllers/batchController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC
// ============================================================

// Registration page
router.get("/active-registration", getActiveRegistrationBatch);

// ============================================================
// LOGGED-IN USER
// ============================================================

// Admin: all batches
// Student/Mentor: their batch history
router.get("/my-batches", protect, getMyBatches);

// Get one batch accessible to current user
router.get("/my-batches/:id", protect, getMyBatch);

// ============================================================
// ADMIN - STATISTICS
// ============================================================

// Detailed dashboard statistics
router.get(
  "/dashboard-stats",
  protect,
  authorize("admin"),
  getBatchDashboardStats,
);

// Simple batch statistics
router.get("/stats", protect, authorize("admin"), getBatchStats);

// ============================================================
// ADMIN - BATCH MANAGEMENT
// ============================================================

// Get all batches
router.get("/", protect, authorize("admin"), getBatches);

// Create batch
router.post("/", protect, authorize("admin"), createBatch);

// Toggle registration
router.patch(
  "/:id/toggle-registration",
  protect,
  authorize("admin"),
  toggleBatchRegistration,
);

// Update batch status
router.patch("/:id/status", protect, authorize("admin"), updateBatchStatus);

// Update batch
router.patch("/:id", protect, authorize("admin"), updateBatch);

// ============================================================
// GET ONE BATCH
// ============================================================

router.get("/:id", protect, getBatchById);

module.exports = router;
