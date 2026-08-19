const progressService = require("../services/progressService");
const User = require("../models/user");

const createProgressContent = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const publishedBy = req.user._id;

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

const getProgressContent = async (req, res) => {
  try {
    const { type, week, batchId } = req.query;

    let selectedBatch = batchId;

    if (req.user.role === "student" && !selectedBatch) {
      selectedBatch = req.user.batch;
    }

    if (req.user.role === "mentor" && !selectedBatch) {
      selectedBatch = req.user.batch;
    }

    const content = await progressService.getProgressContent(
      type,
      week,
      selectedBatch,
    );

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Get progress content error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getContentById = async (req, res) => {
  try {
    const content = await progressService.getContentById(req.params.contentId);

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("Get content by ID error:", error);

    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentProgress = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    let selectedBatch = batchId;

    if (
      req.user.role === "student" &&
      studentId.toString() === req.user._id.toString() &&
      !selectedBatch
    ) {
      selectedBatch = req.user.batch;
    }

    const progress = await progressService.getStudentProgress(
      studentId,
      type,
      week,
      selectedBatch,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get student progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateStudentProgress = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const progress = await progressService.updateStudentProgress(
      studentId,
      req.params.contentId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Progress updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error("Update student progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentSummary = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const summary = await progressService.getStudentSummary(
      studentId,
      type,
      week,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Get student summary error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentRank = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { type, week, batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const rank = await progressService.getStudentRank(
      studentId,
      type,
      week,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    console.error("Get student rank error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getOverallProgress = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { type, week, batchId } = req.query;

    const progress = await progressService.getOverallProgress(
      type,
      week,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get overall progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getGenderProgress = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { gender } = req.params;
    const { type, week, batchId } = req.query;

    const progress = await progressService.getGenderProgress(
      gender,
      type,
      week,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get gender progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getMentorProgress = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required",
      });
    }

    const mentorId = req.params.mentorId || req.user._id;
    const { type, week, batchId } = req.query;

    const progress = await progressService.getMentorProgress(
      mentorId,
      type,
      week,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get mentor progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getProgressDashboard = async (req, res) => {
  try {
    const studentId = req.params.studentId || req.user?._id;
    const { batchId } = req.query;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID required",
      });
    }

    const dashboard = await progressService.getProgressDashboard(
      studentId,
      batchId,
    );

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("Get progress dashboard error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getWeeklyProgress = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const { week } = req.params;
    const { batchId } = req.query;

    const progress = await progressService.getWeeklyProgress(week, batchId);

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("Get weekly progress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const unpublishProgressContent = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const content = await progressService.unpublishProgressContent(
      req.params.contentId,
    );

    return res.status(200).json({
      success: true,
      message: "Progress content unpublished successfully",
      data: content,
    });
  } catch (error) {
    console.error("Unpublish progress content error:", error);

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
