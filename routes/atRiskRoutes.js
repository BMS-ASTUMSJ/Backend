const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getMyRiskStatus,
  getMyAssignedStudents,
  getBatchAtRiskStudents,
} = require("../controllers/atRiskController");

// ============================================================
// STUDENT - GET MY OWN RISK STATUS
// ============================================================

router.get(
  "/my-status",
  protect,
  authorize("student"),
  getMyRiskStatus,
);

// ============================================================
// MENTOR - GET ONLY MY ASSIGNED STUDENTS
// WITH THEIR LIVE RISK STATUS
// ============================================================

router.get(
  "/my-students",
  protect,
  authorize("mentor"),
  getMyAssignedStudents,
);

// ============================================================
// ADMIN - GET AT-RISK STUDENTS FOR A BATCH
// ============================================================

router.get(
  "/batch/:batchId",
  protect,
  authorize("admin"),
  getBatchAtRiskStudents,
);

module.exports = router;