const mongoose = require("mongoose");

const ProjectTracking = require("../models/projectTracking");
const Assignment = require("../models/Assignment");
const Submission = require("../models/Submission");
const Team = require("../models/team");

// ============================================================
// COMPLETE PROJECT TRACKING
//
// IMPORTANT:
//
// This is the ONLY endpoint that creates ProjectTracking.
//
// The frontend may track students locally for as long as
// necessary.
//
// The backend receives the request ONLY after ALL required
// students are marked Completed.
//
// The backend performs the same checks independently so that
// partial tracking cannot be saved by bypassing the frontend.
// ============================================================

const completeProjectTracking = async (req, res) => {
  try {
    const { assignmentId, students } = req.body;

    // ========================================================
    // VALIDATE ASSIGNMENT ID
    // ========================================================

    if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid assignment ID is required.",
      });
    }

    // ========================================================
    // ONLY MENTORS
    // ========================================================

    if (!req.user || req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can complete project tracking.",
      });
    }

    // ========================================================
    // VALIDATE STUDENTS ARRAY
    // ========================================================

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Student tracking data is required.",
      });
    }

    // ========================================================
    // FIND ASSIGNMENT
    // ========================================================

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    // ========================================================
    // CHECK EXISTING TRACKING
    // ========================================================

    const existingTracking = await ProjectTracking.findOne({
      assignment: assignmentId,
      mentor: req.user._id,
    });

    if (existingTracking) {
      return res.status(400).json({
        success: false,
        message: "Project tracking has already been completed.",
        tracking: existingTracking,
      });
    }

    // ========================================================
    // FIND MENTOR'S TEAMS
    // ========================================================

    const teams = await Team.find({
      mentors: req.user._id,
    }).select("students");

    const mentorStudentIds = [
      ...new Set(
        teams.flatMap((team) =>
          (team.students || []).map((student) => student.toString()),
        ),
      ),
    ];

    if (mentorStudentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "You do not have any students assigned to you.",
      });
    }

    // ========================================================
    // FIND SUBMISSIONS FROM MENTOR'S STUDENTS
    // ========================================================

    const submissions = await Submission.find({
      assignment: assignmentId,
      student: {
        $in: mentorStudentIds,
      },
    }).select("student status");

    if (submissions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No students have submitted this assignment yet.",
      });
    }

    // ========================================================
    // STUDENTS WHO MUST BE TRACKED
    // ========================================================

    const submittedStudentIds = [
      ...new Set(
        submissions.map((submission) => submission.student.toString()),
      ),
    ];

    // ========================================================
    // VALIDATE FRONTEND STUDENT IDS
    // ========================================================

    const frontendStudentIds = [
      ...new Set(
        students
          .filter((student) => student && student.student)
          .map((student) => student.student.toString()),
      ),
    ];

    // ========================================================
    // CHECK FOR MISSING STUDENTS
    // ========================================================

    const missingStudents = submittedStudentIds.filter(
      (studentId) => !frontendStudentIds.includes(studentId),
    );

    if (missingStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "You must finish tracking all submitted students before saving.",
      });
    }

    // ========================================================
    // CHECK FOR EXTRA / UNAUTHORIZED STUDENTS
    // ========================================================

    const unauthorizedStudents = frontendStudentIds.filter(
      (studentId) => !submittedStudentIds.includes(studentId),
    );

    if (unauthorizedStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid student tracking data was provided.",
      });
    }

    // ========================================================
    // CHECK DUPLICATE STUDENTS
    // ========================================================

    if (frontendStudentIds.length !== students.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate or invalid student tracking data was provided.",
      });
    }

    // ========================================================
    // CHECK EVERY STUDENT IS COMPLETED
    // ========================================================

    const incompleteStudents = students.filter(
      (student) => !student || student.status !== "Completed",
    );

    if (incompleteStudents.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You must complete tracking for all students before saving.",
      });
    }

    // ========================================================
    // CHECK EVERY SUBMISSION IS GRADED
    // ========================================================

    const ungradedSubmissions = submissions.filter(
      (submission) => submission.status !== "Graded",
    );

    if (ungradedSubmissions.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Every student's assignment must be graded before project tracking can be saved.",
      });
    }

    // ========================================================
    // CREATE FINAL TRACKING DATA
    //
    // ONLY COMPLETED STUDENTS ARE STORED.
    // ========================================================

    const now = new Date();

    const trackedStudents = submittedStudentIds.map((studentId) => ({
      student: studentId,
      status: "Completed",
      trackedAt: now,
    }));

    // ========================================================
    // CREATE ONE FINAL DATABASE RECORD
    // ========================================================

    const tracking = await ProjectTracking.create({
      assignment: assignmentId,

      mentor: req.user._id,

      students: trackedStudents,

      startedAt: now,

      completedAt: now,

      status: "Completed",
    });

    // ========================================================
    // POPULATE RESULT
    // ========================================================

    const populatedTracking = await ProjectTracking.findById(tracking._id)
      .populate("assignment", "title description deadline maxScore batch")
      .populate("mentor", "firstName lastName email")
      .populate("students.student", "firstName lastName email");

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,

      message: "Project tracking completed and saved successfully.",

      tracking: populatedTracking,
    });
  } catch (error) {
    console.error("COMPLETE PROJECT TRACKING ERROR:", error);

    // ========================================================
    // DUPLICATE TRACKING
    // ========================================================

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Project tracking has already been completed.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to complete project tracking.",
    });
  }
};

// ============================================================
// GET COMPLETED PROJECT TRACKING
//
// This ONLY READS the database.
// It never creates tracking.
// ============================================================

const getProjectTracking = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // ========================================================
    // VALIDATE ID
    // ========================================================

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    // ========================================================
    // ONLY MENTORS
    // ========================================================

    if (!req.user || req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors can view project tracking.",
      });
    }

    // ========================================================
    // FIND FINAL TRACKING RECORD
    // ========================================================

    const tracking = await ProjectTracking.findOne({
      assignment: assignmentId,
      mentor: req.user._id,
    })
      .populate("assignment", "title description deadline maxScore batch")
      .populate("mentor", "firstName lastName email")
      .populate("students.student", "firstName lastName email");

    // ========================================================
    // NOT FOUND
    //
    // This is normal if the mentor hasn't completed tracking.
    // ========================================================

    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: "Project tracking has not been completed yet.",
      });
    }

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(200).json({
      success: true,
      tracking,
    });
  } catch (error) {
    console.error("GET PROJECT TRACKING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project tracking.",
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  completeProjectTracking,
  getProjectTracking,
};
