const mongoose = require("mongoose");
const User = require("../models/user");
const Assignment = require("../models/Assignment");
const Attendance = require("../models/attendance");
const Announcement = require("../models/announcement"); // Adjust or omit if model name differs
const { calculateStudentRisk } = require("../services/atRiskService");

const getAttendanceWeight = (status) => {
  switch (status) {
    case "Present":
      return 1.0;
    case "Late":
      return 0.5;
    case "Absent":
      return 0.0;
    default:
      return null;
  }
};

const getStudentDashboardMetrics = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch User Data
    const student = await User.findById(userId).select(
      "firstName lastName fullName batch batchHistory role",
    );

    if (!student || student.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access student dashboard metrics.",
      });
    }

    // 2. Fetch Real Attendance Metrics
    let attendanceRate = 0;
    if (student.batch) {
      const attendanceRecords = await Attendance.find({
        studentId: userId,
        batchId: student.batch,
      }).lean();

      let earnedPoints = 0;
      let applicableChecks = 0;

      attendanceRecords.forEach((record) => {
        [record.firstCheck, record.secondCheck].forEach((check) => {
          if (check && check.status) {
            const weight = getAttendanceWeight(check.status);
            if (weight !== null) {
              earnedPoints += weight;
              applicableChecks++;
            }
          }
        });
      });

      attendanceRate =
        applicableChecks > 0
          ? Number(((earnedPoints / applicableChecks) * 100).toFixed(1))
          : 0;
    }

    // 3. Fetch Real Assignment Count
    let assignmentCount = 0;
    if (student.batch) {
      assignmentCount = await Assignment.countDocuments({
        batch: student.batch,
      });
    }

    // 4. Fetch Real Risk & Calculate Progress
    let progressRate = 100;
    if (student.batch) {
      const risk = await calculateStudentRisk(student._id, student.batch);
      // Example progress calculation: subtract risk impact from 100
      const totalIssues = risk.totalIssues || 0;
      progressRate = Math.max(0, 100 - totalIssues * 10);
    }

    // 5. Fetch Real Announcement Count
    let announcementCount = 0;
    try {
      if (Announcement) {
        announcementCount = await Announcement.countDocuments({
          $or: [{ batch: student.batch }, { target: "all" }],
        });
      }
    } catch (err) {
      announcementCount = 0;
    }

    // 6. Return Aggregated Dashboard Data
    return res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        fullName:
          student.fullName ||
          `${student.firstName || ""} ${student.lastName || ""}`.trim(),
      },
      metrics: {
        attendanceRate,
        assignmentCount,
        progressRate,
        announcementCount,
      },
    });
  } catch (error) {
    console.error("GET STUDENT DASHBOARD METRICS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch student dashboard metrics.",
    });
  }
};

module.exports = { getStudentDashboardMetrics };
