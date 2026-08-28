const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

const {
  getMyRiskStatus,
  getMyAssignedStudents,
  getBatchAtRiskStudents,
} = require("../controllers/atRiskController");

router.get("/my-status", protect, authorize("student"), getMyRiskStatus);

router.get("/my-students", protect, authorize("mentor"), getMyAssignedStudents);

router.get(
  "/batch/:batchId",
  protect,
  authorize("admin"),
  getBatchAtRiskStudents,
);

module.exports = router;
