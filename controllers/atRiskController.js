const mongoose = require("mongoose");

const User = require("../models/user");
const Batch = require("../models/batch");

const { calculateStudentRisk } = require("../services/atRiskService");

// ============================================================
// DEFAULT EMPTY RISK
// ============================================================

const emptyRisk = {
  attendanceIssues: 0,
  assignmentIssues: 0,
  totalIssues: 0,
  isAtRisk: false,
};

// ============================================================
// STUDENT - GET MY RISK STATUS
// ============================================================

const getMyRiskStatus = async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select("_id role batch");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    if (student.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can access their risk status.",
      });
    }

    if (!student.batch) {
      return res.status(200).json({
        success: true,
        risk: emptyRisk,
      });
    }

    const risk = await calculateStudentRisk(student._id, student.batch);

    return res.status(200).json({
      success: true,
      risk,
    });
  } catch (error) {
    console.error("GET MY RISK STATUS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get risk status.",
    });
  }
};

// ============================================================
// ADMIN - GET ALL AT RISK STUDENTS IN A BATCH
// ============================================================

const getBatchAtRiskStudents = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const students = await User.find({
      role: "student",
      batch: batchId,
    })
      .select("_id firstName lastName fullName schoolId email gender")
      .sort({
        firstName: 1,
        lastName: 1,
      });

    const studentRiskResults = await Promise.all(
      students.map(async (student) => {
        const risk = await calculateStudentRisk(student._id, batchId);

        return {
          _id: student._id,

          firstName: student.firstName,

          lastName: student.lastName,

          fullName:
            student.fullName ||
            `${student.firstName || ""} ${student.lastName || ""}`.trim(),

          schoolId: student.schoolId,

          email: student.email,

          gender: student.gender,

          attendanceIssues: risk.attendanceIssues,

          assignmentIssues: risk.assignmentIssues,

          totalIssues: risk.totalIssues,

          isAtRisk: risk.isAtRisk,
        };
      }),
    );

    const atRiskStudents = studentRiskResults.filter(
      (student) => student.isAtRisk === true,
    );

    return res.status(200).json({
      success: true,

      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
      },

      totalStudents: students.length,

      atRiskCount: atRiskStudents.length,

      students: atRiskStudents,
    });
  } catch (error) {
    console.error("GET BATCH AT RISK STUDENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get at-risk students.",
    });
  }
};

module.exports = {
  getMyRiskStatus,
  getBatchAtRiskStudents,
};
