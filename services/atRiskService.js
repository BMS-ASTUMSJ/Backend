const Attendance = require("../models/attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");

// ============================================================
// RISK RULES
// ============================================================

const ABSENCE_THRESHOLD = 2;
const MISSED_ASSIGNMENT_THRESHOLD = 2;

// ============================================================
// CALCULATE STUDENT RISK
// ============================================================

const calculateStudentRisk = async (studentId, batchId) => {
  try {
    if (!studentId || !batchId) {
      return {
        attendanceIssues: 0,
        assignmentIssues: 0,
        totalIssues: 0,
        isAtRisk: false,
        reason: [],
      };
    }

    // ========================================================
    // ATTENDANCE
    //
    // Count each attendance check marked as Absent.
    // firstCheck Absent = 1 absence
    // secondCheck Absent = 1 absence
    // ========================================================

    const attendanceRecords = await Attendance.find({
      studentId,
      batchId,
    }).select("firstCheck secondCheck");

    let absenceCount = 0;

    attendanceRecords.forEach((record) => {
      if (record.firstCheck?.status === "Absent") {
        absenceCount += 1;
      }

      if (record.secondCheck?.status === "Absent") {
        absenceCount += 1;
      }
    });

    // ========================================================
    // ASSIGNMENTS
    //
    // Get all assignments for this batch
    // ========================================================

    const assignments = await Assignment.find({
      batch: batchId,
    }).select("_id deadline");

    // Get all assignments submitted by this student
    const submissions = await Submission.find({
      student: studentId,
      assignment: {
        $in: assignments.map((assignment) => assignment._id),
      },
    }).select("assignment");

    const submittedAssignmentIds = new Set(
      submissions.map((submission) => String(submission.assignment)),
    );

    const now = new Date();

    // ========================================================
    // MISSED ASSIGNMENTS
    //
    // An assignment counts as missed only when:
    // 1. Deadline has passed
    // 2. Student did not submit
    // ========================================================

    const missedAssignments = assignments.filter((assignment) => {
      const deadlinePassed = new Date(assignment.deadline) < now;

      const wasSubmitted = submittedAssignmentIds.has(String(assignment._id));

      return deadlinePassed && !wasSubmitted;
    });

    const missedAssignmentCount = missedAssignments.length;

    // ========================================================
    // DETERMINE RISK
    //
    // Student is at risk if:
    // - 2 or more absences
    // OR
    // - 2 or more missed assignments
    // ========================================================

    const attendanceAtRisk = absenceCount >= ABSENCE_THRESHOLD;

    const assignmentAtRisk =
      missedAssignmentCount >= MISSED_ASSIGNMENT_THRESHOLD;

    const isAtRisk = attendanceAtRisk || assignmentAtRisk;

    const reason = [];

    if (attendanceAtRisk) {
      reason.push(`${absenceCount} absence${absenceCount === 1 ? "" : "s"}`);
    }

    if (assignmentAtRisk) {
      reason.push(
        `${missedAssignmentCount} missed assignment${
          missedAssignmentCount === 1 ? "" : "s"
        }`,
      );
    }

    return {
      attendanceIssues: absenceCount,

      assignmentIssues: missedAssignmentCount,

      totalIssues: absenceCount + missedAssignmentCount,

      absenceCount,

      missedAssignmentCount,

      attendanceAtRisk,

      assignmentAtRisk,

      isAtRisk,

      reason,

      message: isAtRisk
        ? `Student is at risk due to ${reason.join(" and ")}.`
        : "Student is currently on track.",
    };
  } catch (error) {
    console.error("CALCULATE STUDENT RISK ERROR:", error);

    throw error;
  }
};

module.exports = {
  calculateStudentRisk,
};
