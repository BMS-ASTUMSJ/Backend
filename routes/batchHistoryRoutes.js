const express = require("express");

const {
  getMyBatchHistory,
  getMyBatch,
  getAllBatchesForAdmin,
  getBatchMembersForAdmin,
} = require("../controllers/batchHistoryController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/my", protect, authorize("mentor"), getMyBatchHistory);

router.get("/my/:batchId", protect, authorize("mentor"), getMyBatch);

router.get(
  "/admin/batches",
  protect,
  authorize("admin"),
  getAllBatchesForAdmin,
);

router.get(
  "/admin/batches/:batchId/members",
  protect,
  authorize("admin"),
  getBatchMembersForAdmin,
);

module.exports = router;
