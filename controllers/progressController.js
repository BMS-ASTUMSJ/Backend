const progressService = require("../services/progressService");
const User = require("../models/user");

// 1. CREATE / PUBLISH PROGRESS CONTENT
const createProgressContent = async (req, res) => {
  try {
    let publishedBy = req.user?._id || req.body.publishedBy;

    // Fallback: If no user attached to request, find default admin ID
    if (!publishedBy) {
      const admin = await User.findOne({ role: "admin" });
      if (admin) publishedBy = admin._id;
    }

    if (!publishedBy) {
      return res.status(401).json({
        success: false,
        message: "Admin account required to publish curriculum.",
      });
    }

    const content = await progressService.createProgressContent({
      ...req.body,
      publishedBy,
    });

    return res.status(201).json({
      success: true,
      message: "Progress content published successfully",
      data: content,
    });
  } catch (error) {
    console.error("Create progress content error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to publish progress content",
    });
  }
};

// 2. GET PUBLISHED CONTENT (Filterable by Type, Week, Batch)
const getProgressContent = async (req, res) => {
  try {
    const { type, week, batchId } = req.query;
    const content = await progressService.getProgressContent(type, week, batchId);

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 3. GET CONTENT BY ID
const getContentById = async (req, res) => {
  try {
    const content = await progressService.getContentById(req.params.contentId);
    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// 4. GET STUDENT PROGRESS CHECKLIST
const getStudentProgress = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID required" });
    }

    const progress = await progressService.getStudentProgress(studentId, type, week, batchId);
    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 5. UPDATE STUDENT PROGRESS
const updateStudentProgress = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID required" });
    }

    const progress = await progressService.updateStudentProgress(
      studentId,
      req.params.contentId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Progress updated successfully",
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 6. GET STUDENT SUMMARY
const getStudentSummary = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    const summary = await progressService.getStudentSummary(studentId, type, week, batchId);
    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 7. GET STUDENT RANK
const getStudentRank = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    const rank = await progressService.getStudentRank(studentId, type, week, batchId);
    return res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 8. GET OVERALL PROGRESS (Leaderboard)
const getOverallProgress = async (req, res) => {
  try {
    const { type, week, batchId } = req.query;
    const progress = await progressService.getOverallProgress(type, week, batchId);

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 9. GET GENDER PROGRESS
const getGenderProgress = async (req, res) => {
  try {
    const { gender } = req.params;
    const { type, week, batchId } = req.query;

    const progress = await progressService.getGenderProgress(gender, type, week, batchId);
    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 10. GET MENTOR PROGRESS (Assigned students of matching gender)
const getMentorProgress = async (req, res) => {
  try {
    const mentorId = req.params.mentorId || req.user?._id;
    const { type, week, batchId } = req.query;

    if (!mentorId) {
      return res.status(400).json({ success: false, message: "Mentor ID required" });
    }

    const progress = await progressService.getMentorProgress(mentorId, type, week, batchId);
    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 11. GET STUDENT DASHBOARD
const getProgressDashboard = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Student ID required" });
    }

    const dashboard = await progressService.getProgressDashboard(studentId, batchId);
    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 12. GET WEEKLY PROGRESS
const getWeeklyProgress = async (req, res) => {
  try {
    const { week } = req.params;
    const { batchId } = req.query;

    const progress = await progressService.getWeeklyProgress(week, batchId);
    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// 13. UNPUBLISH CONTENT
const unpublishProgressContent = async (req, res) => {
  try {
    const content = await progressService.unpublishProgressContent(req.params.contentId);
    return res.status(200).json({
      success: true,
      message: "Progress content unpublished successfully",
      data: content,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createProgressContent,
  getProgressContent,
  getContentById,
  getStudentProgress,
  updateStudentProgress,
  getStudentSummary,
  getStudentRank,
  getOverallProgress,
  getGenderProgress,
  getMentorProgress,
  getProgressDashboard,
  getWeeklyProgress,
  unpublishProgressContent,
};