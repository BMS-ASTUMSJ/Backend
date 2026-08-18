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
} = require("../controllers/batchController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

// ============================================================
// PUBLIC
// ============================================================

// Used by Registration page
router.get("/active-registration", getActiveRegistrationBatch);

// ============================================================
// LOGGED-IN USER
// ============================================================

// Student/Mentor:
// only batches where they have a membership.
//
// Admin:
// all batches.
router.get("/my-batches", protect, getMyBatches);

// Get one batch that belongs to the logged-in user.
router.get("/my-batches/:id", protect, getMyBatch);

// ============================================================
// ADMIN
// ============================================================

// Get batch dashboard statistics
router.get("/stats", protect, authorize("admin"), getBatchDashboardStats);

// Get list of all batches
router.get("/", protect, authorize("admin"), getBatches);

// Create new batch
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

module.exports = router;
