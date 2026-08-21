const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getMyRiskStatus,
  getBatchAtRiskStudents,
} = require("../controllers/atRiskController");

// ============================================================
// STUDENT - GET MY RISK STATUS
// ============================================================

router.get("/my-status", protect, authorize("student"), getMyRiskStatus);

// ============================================================
// ADMIN - GET AT RISK STUDENTS FOR A BATCH
// ============================================================

router.get(
  "/batch/:batchId",
  protect,
  authorize("admin"),
  getBatchAtRiskStudents,
);

module.exports = router;
