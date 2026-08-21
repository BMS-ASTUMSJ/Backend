const Attendance = require("../models/attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");

// ============================================================
// AT RISK RULE
// ============================================================
//
// ATTENDANCE:
// Absent = 1 issue
// Late = 1 issue
// Present = 0 issues
// Excused = 0 issues
//
// ASSIGNMENTS:
// No submission after deadline = 1 issue
// Resubmission Required = 1 issue
//
// FINAL:
// More than 2 total issues = AT RISK
//
// ============================================================

const calculateStudentRisk = async (studentId, batchId) => {
  // ==========================================================
  // ATTENDANCE ISSUES
  // ==========================================================

  const attendanceRecords = await Attendance.find({
    studentId,
    batchId,
  }).select("firstCheck secondCheck");

  let attendanceIssues = 0;

  attendanceRecords.forEach((record) => {
    const checks = [record.firstCheck, record.secondCheck];

    checks.forEach((check) => {
      if (!check || !check.status) {
        return;
      }

      if (check.status === "Absent" || check.status === "Late") {
        attendanceIssues += 1;
      }
    });
  });

  // ==========================================================
  // ASSIGNMENT ISSUES
  // ==========================================================

  const assignments = await Assignment.find({
    batch: batchId,
  }).select("_id deadline");

  const assignmentIds = assignments.map((assignment) => assignment._id);

  const submissions =
    assignmentIds.length > 0
      ? await Submission.find({
          student: studentId,
          assignment: {
            $in: assignmentIds,
          },
        }).select("assignment status")
      : [];

  const submissionMap = new Map();

  submissions.forEach((submission) => {
    submissionMap.set(String(submission.assignment), submission);
  });

  let assignmentIssues = 0;

  const now = new Date();

  assignments.forEach((assignment) => {
    const submission = submissionMap.get(String(assignment._id));

    // --------------------------------------------------------
    // NO SUBMISSION AFTER DEADLINE
    // --------------------------------------------------------

    if (!submission) {
      if (assignment.deadline && now > new Date(assignment.deadline)) {
        assignmentIssues += 1;
      }

      return;
    }

    // --------------------------------------------------------
    // RESUBMISSION REQUIRED
    // --------------------------------------------------------

    if (submission.status === "Resubmission Required") {
      assignmentIssues += 1;
    }
  });

  // ==========================================================
  // FINAL RISK CALCULATION
  // ==========================================================

  const totalIssues = attendanceIssues + assignmentIssues;

  const isAtRisk = totalIssues > 2;

  return {
    attendanceIssues,
    assignmentIssues,
    totalIssues,
    isAtRisk,
  };
};

// ============================================================
// CALCULATE RISK FOR MULTIPLE STUDENTS
// ============================================================

const calculateStudentsRisk = async (students, batchId) => {
  return await Promise.all(
    students.map(async (student) => {
      const risk = await calculateStudentRisk(student._id, batchId);

      return {
        studentId: student._id,
        ...risk,
      };
    }),
  );
};

module.exports = {
  calculateStudentRisk,
  calculateStudentsRisk,
};
