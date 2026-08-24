const express = require("express");
const router = express.Router();

const {
  markAttendance,
  markBulkAttendance,
  getMentorStudents,
  getTeamRecordsForSession,
  getStudentAttendance,
  getAdminAttendanceStats,
  getAdminBatchReport,
} = require("../controllers/attendanceController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get("/my-team", protect, authorize("mentor"), getMentorStudents);
router.get("/team-records", protect, authorize("mentor"), getTeamRecordsForSession);
router.post("/mark", protect, authorize("mentor"), markAttendance);
router.post("/mark-bulk", protect, authorize("mentor"), markBulkAttendance);
router.get("/my-records", protect, getStudentAttendance);
router.get("/admin-stats", protect, authorize("admin"), getAdminAttendanceStats);
router.get("/admin-report/:batchId", protect, authorize("admin"), getAdminBatchReport);

module.exports = router;