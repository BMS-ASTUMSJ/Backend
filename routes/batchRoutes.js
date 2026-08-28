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

router.get("/active-registration", getActiveRegistrationBatch);

router.get("/my-batches", protect, getMyBatches);
router.get("/my-batches/:id", protect, getMyBatch);

router.get(
  "/dashboard-stats",
  protect,
  authorize("admin"),
  getBatchDashboardStats
);

router.get(
  "/stats",
  protect,
  authorize("admin"),
  getBatchStats
);

router.post(
  "/",
  protect,
  authorize("admin"),
  createBatch
);

router.get(
  "/",
  protect,
  authorize("admin"),
  getBatches
);

router.patch(
  "/:id/toggle-registration",
  protect,
  authorize("admin"),
  toggleBatchRegistration
);

router.patch(
  "/:id/status",
  protect,
  authorize("admin"),
  updateBatchStatus
);

router.patch(
  "/:id",
  protect,
  authorize("admin"),
  updateBatch
);

router.get(
  "/:id",
  protect,
  getBatchById
);

module.exports = router;