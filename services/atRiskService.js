const Attendance = require("../models/attendance");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");



const ABSENCE_THRESHOLD = 2;
const MISSED_ASSIGNMENT_THRESHOLD = 2;

// 
// CALCULATE STUDENT RISK
// ============================================================

const calculateStudentRisk = async (studentId, batchId) => {
  try {
    if (!studentId || !batchId) {
      return {
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
    }

    // ========================================================
    // ATTENDANCE
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
    // ASSIGNMENTS FOR THIS BATCH
    // ========================================================

    const assignments = await Assignment.find({
      batch: batchId,
    }).select("_id deadline");

    const assignmentIds = assignments.map((assignment) => assignment._id);

    // ========================================================
    // STUDENT SUBMISSIONS
    // ========================================================

    const submissions = await Submission.find({
      student: studentId,
      assignment: {
        $in: assignmentIds,
      },
    }).select("assignment");

    const submittedAssignmentIds = new Set(
      submissions.map((submission) => String(submission.assignment)),
    );

    // ========================================================
    // MISSED ASSIGNMENTS
    //
    // An assignment is missed when:
    // 1. Deadline has passed
    // 2. Student did not submit
    // ========================================================

    const now = new Date();

    const missedAssignments = assignments.filter((assignment) => {
      const deadlinePassed =
        assignment.deadline && new Date(assignment.deadline) < now;

      const wasSubmitted = submittedAssignmentIds.has(String(assignment._id));

      return deadlinePassed && !wasSubmitted;
    });

    const missedAssignmentCount = missedAssignments.length;

    // ========================================================
    // DETERMINE RISK
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
