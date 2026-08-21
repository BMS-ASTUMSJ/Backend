const express = require("express");

const router = express.Router();

const attendanceController = require("../controllers/attendanceController");

const protect = require("../middleware/authMiddleware");
const authorize = require("../middleware/roleMiddleware");

router.get(
  "/my-team",
  protect,
  authorize("mentor"),
  attendanceController.getMentorStudents,
);

router.get(
  "/team-records",
  protect,
  authorize("mentor"),
  attendanceController.getTeamRecordsForSession,
);

router.post(
  "/mark",
  protect,
  authorize("mentor"),
  attendanceController.markAttendance,
);

router.get("/my-records", protect, attendanceController.getStudentAttendance);

router.get(
  "/admin-stats",
  protect,
  authorize("admin"),
  attendanceController.getAdminAttendanceStats,
);

router.get(
  "/admin-report/:batchId",
  protect,
  authorize("admin"),
  attendanceController.getAdminBatchReport,
);

module.exports = router;
