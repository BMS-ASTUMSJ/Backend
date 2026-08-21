const mongoose = require("mongoose");
const Submission = require("../models/Submission");
const Assignment = require("../models/Assignment");
const Team = require("../models/team");
const User = require("../models/user");

const submitAssignment = async (req, res) => {
  try {
    const { assignmentId, githubUrl, liveDemoUrl, notes } = req.body;

    if (!assignmentId || !mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid assignment ID is required.",
      });
    }

    if (!githubUrl || !githubUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "GitHub URL is required.",
      });
    }

    const student = await User.findById(req.user._id).select("role batch");

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student account not found.",
      });
    }

    if (student.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Only students can submit assignments.",
      });
    }

    if (!student.batch) {
      return res.status(400).json({
        success: false,
        message: "You are not assigned to a batch.",
      });
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (
      !assignment.batch ||
      assignment.batch.toString() !== student.batch.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "This assignment is not assigned to your batch.",
      });
    }

    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      return res.status(400).json({
        success: false,
        message: "The assignment deadline has passed.",
      });
    }

    const existingSubmission = await Submission.findOne({
      assignment: assignmentId,
      student: student._id,
    });

    if (!existingSubmission) {
      const submission = await Submission.create({
        assignment: assignmentId,
        student: student._id,

        githubUrl: githubUrl.trim(),

        liveDemoUrl: liveDemoUrl?.trim() || "",

        notes: notes?.trim() || "",

        score: null,
        feedback: "",
        status: "Pending",
        gradedBy: null,
        gradedAt: null,
      });

      const populatedSubmission = await Submission.findById(submission._id)
        .populate("assignment", "title description deadline maxScore batch")
        .populate("student", "firstName lastName email");

      return res.status(201).json({
        success: true,
        message: "Assignment submitted successfully.",
        submission: populatedSubmission,
      });
    }

    if (existingSubmission.status !== "Resubmission Required") {
      return res.status(400).json({
        success: false,
        message:
          "This assignment has already been submitted. Use Update Submission while it is pending, or wait for your mentor to request a resubmission.",
      });
    }

    existingSubmission.githubUrl = githubUrl.trim();

    existingSubmission.liveDemoUrl = liveDemoUrl?.trim() || "";

    existingSubmission.notes = notes?.trim() || "";

    existingSubmission.score = null;
    existingSubmission.feedback = "";
    existingSubmission.status = "Pending";
    existingSubmission.gradedBy = null;
    existingSubmission.gradedAt = null;

    await existingSubmission.save();

    const populatedSubmission = await Submission.findById(
      existingSubmission._id,
    )
      .populate("assignment", "title description deadline maxScore batch")
      .populate("student", "firstName lastName email");

    return res.status(200).json({
      success: true,
      message:
        "Assignment resubmitted successfully. It is now waiting for review.",
      submission: populatedSubmission,
    });
  } catch (error) {
    console.error("SUBMISSION ERROR:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this assignment.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to submit assignment.",
    });
  }
};

const updateSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const { githubUrl, liveDemoUrl, notes } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID.",
      });
    }

    if (!githubUrl || !githubUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: "GitHub URL is required.",
      });
    }

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found.",
      });
    }

    if (submission.student.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update this submission.",
      });
    }

    if (submission.status !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "You can only update a submission while it is pending.",
      });
    }

    const assignment = await Assignment.findById(submission.assignment);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      return res.status(400).json({
        success: false,
        message: "The assignment deadline has passed.",
      });
    }

    submission.githubUrl = githubUrl.trim();

    submission.liveDemoUrl = liveDemoUrl?.trim() || "";

    submission.notes = notes?.trim() || "";

    submission.status = "Pending";

    await submission.save();

    const updatedSubmission = await Submission.findById(submission._id)
      .populate("assignment", "title description deadline maxScore batch")
      .populate("student", "firstName lastName email")
      .populate("gradedBy", "firstName lastName email");

    return res.status(200).json({
      success: true,
      message: "Submission updated successfully.",
      submission: updatedSubmission,
    });
  } catch (error) {
    console.error("UPDATE SUBMISSION ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update submission.",
    });
  }
};

const gradeSubmission = async (req, res) => {
  try {
    const { id } = req.params;

    const { score, feedback = "", status = "Graded" } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID.",
      });
    }

    if (score === undefined || score === null || score === "") {
      return res.status(400).json({
        success: false,
        message: "Score is required.",
      });
    }

    const numericScore = Number(score);

    if (!Number.isFinite(numericScore)) {
      return res.status(400).json({
        success: false,
        message: "Score must be a valid number.",
      });
    }

    if (numericScore < 0) {
      return res.status(400).json({
        success: false,
        message: "Score cannot be negative.",
      });
    }

    if (status !== "Graded" && status !== "Resubmission Required") {
      return res.status(400).json({
        success: false,
        message: "Status must be Graded or Resubmission Required.",
      });
    }

    const submission = await Submission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found.",
      });
    }

    const assignment = await Assignment.findById(submission.assignment);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment associated with this submission was not found.",
      });
    }

    const maxScore = Number(assignment.maxScore);

    if (!Number.isFinite(maxScore) || maxScore < 0) {
      return res.status(400).json({
        success: false,
        message: "Assignment has an invalid maximum score.",
      });
    }

    if (numericScore > maxScore) {
      return res.status(400).json({
        success: false,
        message: `Score cannot exceed ${maxScore}.`,
      });
    }

    if (req.user.role === "mentor") {
      const team = await Team.findOne({
        mentors: req.user._id,
        students: submission.student,
      });

      if (!team) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this student.",
        });
      }
    }

    if (req.user.role !== "admin" && req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Only mentors and admins can grade submissions.",
      });
    }

    submission.score = numericScore;

    submission.feedback = typeof feedback === "string" ? feedback.trim() : "";

    submission.status = status;

    submission.gradedBy = req.user._id;

    submission.gradedAt = new Date();

    await submission.save();

    const result = await Submission.findById(submission._id)
      .populate("assignment", "title description deadline maxScore batch")
      .populate("student", "firstName lastName email")
      .populate("gradedBy", "firstName lastName email");

    return res.status(200).json({
      success: true,
      message:
        status === "Resubmission Required"
          ? "Resubmission request sent successfully."
          : "Submission graded successfully.",
      submission: result,
    });
  } catch (error) {
    console.error("GRADING ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update grade.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getSubmissionsByAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await Assignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    let query = {
      assignment: assignmentId,
    };

    if (req.user.role === "mentor") {
      const teams = await Team.find({
        mentors: req.user._id,
      }).select("students");

      const studentIds = teams.flatMap((team) => team.students || []);

      query.student = {
        $in: studentIds,
      };
    }

    const submissions = await Submission.find(query)
      .populate("student", "firstName lastName email")
      .populate("assignment", "title deadline maxScore batch")
      .populate("gradedBy", "firstName lastName email")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("GET SUBMISSIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submissions.",
    });
  }
};

const getMySubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({
      student: req.user._id,
    })
      .populate("assignment", "title description deadline maxScore batch")
      .populate("gradedBy", "firstName lastName email")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("GET MY SUBMISSIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch your submissions.",
    });
  }
};

module.exports = {
  submitAssignment,
  updateSubmission,
  gradeSubmission,
  getSubmissionsByAssignment,
  getMySubmissions,
};
