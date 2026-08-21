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
  absenceCount: 0,
  missedAssignmentCount: 0,
  attendanceAtRisk: false,
  assignmentAtRisk: false,
  isAtRisk: false,
  reason: [],
  message: "Student is currently on track.",
};

// ============================================================
// STUDENT - GET MY RISK STATUS
// ============================================================

const getMyRiskStatus = async (req, res) => {
  try {
    const student = await User.findById(req.user._id).select(
      "_id role batch",
    );

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

    // Optional: keep the stored atRisk field updated
    if (student.atRisk !== risk.isAtRisk) {
      await User.findByIdAndUpdate(student._id, {
        atRisk: risk.isAtRisk,
      });
    }

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
// MENTOR - GET ONLY MY ASSIGNED STUDENTS WITH RISK STATUS
// ============================================================

const getMyAssignedStudents = async (req, res) => {
  try {
    const mentor = await User.findById(req.user._id)
      .select("_id role assignedStudents")
      .populate({
        path: "assignedStudents",
        select:
          "_id firstName lastName fullName schoolId email gender batch profileImage",
        populate: {
          path: "batch",
          select: "_id name",
        },
      });

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found.",
      });
    }

    if (mentor.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can access this page.",
      });
    }

    const assignedStudents = (mentor.assignedStudents || []).filter(
      (student) => student && student.role !== "mentor",
    );

    const studentsWithRisk = await Promise.all(
      assignedStudents.map(async (student) => {
        // Student has no current batch
        if (!student.batch) {
          const risk = emptyRisk;

          await User.findByIdAndUpdate(student._id, {
            atRisk: false,
          });

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
            profileImage: student.profileImage,
            batch: null,
            atRisk: false,
            risk,
          };
        }

        const batchId = student.batch._id || student.batch;

        // Calculate LIVE risk
        const risk = await calculateStudentRisk(student._id, batchId);

        // Update the student's stored atRisk field
        await User.findByIdAndUpdate(student._id, {
          atRisk: risk.isAtRisk,
        });

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

          profileImage: student.profileImage,

          batch: student.batch,

          // IMPORTANT FOR FRONTEND
          atRisk: risk.isAtRisk,

          // IMPORTANT FOR FRONTEND
          risk: {
            attendanceIssues: risk.attendanceIssues,
            assignmentIssues: risk.assignmentIssues,
            totalIssues: risk.totalIssues,
            absenceCount: risk.absenceCount,
            missedAssignmentCount: risk.missedAssignmentCount,
            attendanceAtRisk: risk.attendanceAtRisk,
            assignmentAtRisk: risk.assignmentAtRisk,
            isAtRisk: risk.isAtRisk,
            reason: risk.reason,
            message: risk.message,
          },
        };
      }),
    );

    return res.status(200).json({
      success: true,
      totalStudents: studentsWithRisk.length,
      atRiskCount: studentsWithRisk.filter(
        (student) => student.atRisk === true,
      ).length,
      students: studentsWithRisk,
    });
  } catch (error) {
    console.error("GET MY ASSIGNED STUDENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get your assigned students.",
    });
  }
};

// ============================================================
// ADMIN - GET ALL AT-RISK STUDENTS IN A BATCH
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
      .select(
        "_id firstName lastName fullName schoolId email gender profileImage",
      )
      .sort({
        firstName: 1,
        lastName: 1,
      });

    const studentRiskResults = await Promise.all(
      students.map(async (student) => {
        const risk = await calculateStudentRisk(student._id, batchId);

        await User.findByIdAndUpdate(student._id, {
          atRisk: risk.isAtRisk,
        });

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

          profileImage: student.profileImage,

          atRisk: risk.isAtRisk,

          risk,
        };
      }),
    );

    const atRiskStudents = studentRiskResults.filter(
      (student) => student.atRisk === true,
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
  getMyAssignedStudents,
  getBatchAtRiskStudents,
};