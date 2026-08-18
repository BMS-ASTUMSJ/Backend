const express = require("express");

const {
  getMyBatchHistory,
  getMyBatch,
} = require("../controllers/batchHistoryController");

const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/my", protect, getMyBatchHistory);

router.get("/my/:batchId", protect, getMyBatch);

module.exports = router;
