const mongoose = require("mongoose");

const MentorAssignment = require("../models/mentorAssignment");
const MentorAssignmentSubmission = require("../models/mentorAssignmentSubmission");

const submitMentorAssignment = async (req, res) => {
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

    const assignment = await MentorAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    const assigned = assignment.assignedStudents.some(
      (studentId) => studentId.toString() === req.user._id.toString(),
    );

    if (!assigned) {
      return res.status(403).json({
        success: false,
        message: "This assignment is not assigned to you.",
      });
    }

    if (assignment.deadline && new Date() > new Date(assignment.deadline)) {
      return res.status(400).json({
        success: false,
        message: "The assignment deadline has passed.",
      });
    }

    const existing = await MentorAssignmentSubmission.findOne({
      assignment: assignmentId,
      student: req.user._id,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "You have already submitted this assignment.",
      });
    }

    const submission = await MentorAssignmentSubmission.create({
      assignment: assignmentId,
      student: req.user._id,
      githubUrl: githubUrl.trim(),
      liveDemoUrl: liveDemoUrl?.trim() || "",
      notes: notes?.trim() || "",
    });

    const result = await MentorAssignmentSubmission.findById(submission._id)
      .populate("student", "firstName lastName email")
      .populate("assignment", "title description deadline");

    return res.status(201).json({
      success: true,
      message: "Assignment submitted successfully.",
      submission: result,
    });
  } catch (error) {
    console.error("SUBMIT MENTOR ASSIGNMENT ERROR:", error);

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

const getMentorAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid assignment ID.",
      });
    }

    const assignment = await MentorAssignment.findById(assignmentId);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (assignment.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view submissions for your own assignments.",
      });
    }

    const submissions = await MentorAssignmentSubmission.find({
      assignment: assignmentId,
    })
      .populate("student", "firstName lastName email")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("GET MENTOR ASSIGNMENT SUBMISSIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch submissions.",
    });
  }
};

const giveMentorFeedback = async (req, res) => {
  try {
    const { id } = req.params;
    const { feedback } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid submission ID.",
      });
    }

    if (!feedback || !feedback.trim()) {
      return res.status(400).json({
        success: false,
        message: "Feedback is required.",
      });
    }

    const submission = await MentorAssignmentSubmission.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found.",
      });
    }

    const assignment = await MentorAssignment.findById(submission.assignment);

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: "Assignment not found.",
      });
    }

    if (assignment.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to give feedback here.",
      });
    }

    submission.feedback = feedback.trim();
    submission.feedbackAt = new Date();

    await submission.save();

    const result = await MentorAssignmentSubmission.findById(submission._id)
      .populate("student", "firstName lastName email")
      .populate("assignment", "title description deadline");

    return res.status(200).json({
      success: true,
      message: "Feedback sent successfully.",
      submission: result,
    });
  } catch (error) {
    console.error("MENTOR FEEDBACK ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to send feedback.",
    });
  }
};

const getMyMentorSubmissions = async (req, res) => {
  try {
    const submissions = await MentorAssignmentSubmission.find({
      student: req.user._id,
    })
      .populate("assignment", "title description deadline mentor")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    console.error("GET MY MENTOR SUBMISSIONS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch mentor submissions.",
    });
  }
};

module.exports = {
  submitMentorAssignment,
  getMentorAssignmentSubmissions,
  giveMentorFeedback,
  getMyMentorSubmissions,
};
