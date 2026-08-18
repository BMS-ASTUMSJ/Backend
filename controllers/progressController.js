const progressService = require("../services/progressService");

const createProgressContent = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const content = await progressService.createProgressContent({
      ...req.body,
      publishedBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Progress content published successfully",
      data: content,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
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
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentProgress = async (req, res) => {
  try {
    const studentId = req.user._id;
    const { type, week, batchId } = req.query;

    const progress = await progressService.getStudentProgress(
      studentId,
      type,
      week,
      batchId,
    );

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

const updateStudentProgress = async (req, res) => {
  try {
    const studentId = req.user._id;

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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentSummary = async (req, res) => {
  try {
    const { type, week, batchId } = req.query;

    const summary = await progressService.getStudentSummary(
      req.user._id,
      type,
      week,
      batchId,
    );

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

const getStudentRank = async (req, res) => {
  try {
    const { type, week, batchId } = req.query;

    const rank = await progressService.getStudentRank(
      req.user._id,
      type,
      week,
      batchId,
    );

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

const getOverallProgress = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getGenderProgress = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getMentorProgress = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required",
      });
    }

    const mentorId = req.user._id;
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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getProgressDashboard = async (req, res) => {
  try {
    const { batchId } = req.query;

    const dashboard = await progressService.getProgressDashboard(
      req.user._id,
      batchId,
    );

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

const getWeeklyProgress = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const unpublishProgressContent = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
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
