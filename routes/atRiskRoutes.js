const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getMyRiskStatus,
  getBatchAtRiskStudents,
} = require("../controllers/atRiskController");

router.get("/my-status", protect, authorize("student"), getMyRiskStatus);

router.get(
  "/batch/:batchId",
  protect,
  authorize("admin"),
  getBatchAtRiskStudents,
);

module.exports = router;
