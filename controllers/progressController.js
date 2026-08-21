const progressService = require("../services/progressService");

// ======================================================
// ADMIN - CREATE PROGRESS CONTENT
// ======================================================

const createProgressContent = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const content =
      await progressService.createProgressContent({
        ...req.body,
        publishedBy: req.user._id,
      });

    return res.status(201).json({
      success: true,
      message:
        "Progress content published successfully",
      data: content,
    });
  } catch (error) {
    console.error(
      "createProgressContent error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ALL PROGRESS CONTENT
// ======================================================

const getProgressContent = async (
  req,
  res
) => {
  try {
    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const content =
      await progressService.getProgressContent(
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error(
      "getProgressContent error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// GET ONE CONTENT
// ======================================================

const getContentById = async (
  req,
  res
) => {
  try {
    const content =
      await progressService.getContentById(
        req.params.contentId
      );

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error(
      "getContentById error:",
      error
    );

    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// STUDENT - GET OWN PROGRESS
// ======================================================

const getStudentProgress = async (
  req,
  res
) => {
  try {
    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const progress =
      await progressService.getStudentProgress(
        req.user._id,
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error(
      "getStudentProgress error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// STUDENT - UPDATE OWN PROGRESS
// ======================================================

const updateStudentProgress = async (
  req,
  res
) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Student access required",
      });
    }

    const {
      contentId,
    } = req.params;

    if (!contentId) {
      return res.status(400).json({
        success: false,
        message:
          "Content ID is required",
      });
    }

    const progress =
      await progressService.updateStudentProgress(
        req.user._id,
        contentId,
        req.body
      );

    return res.status(200).json({
      success: true,
      message:
        "Student progress updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error(
      "updateStudentProgress error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// STUDENT - SUMMARY
// ======================================================

const getStudentSummary = async (
  req,
  res
) => {
  try {
    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const summary =
      await progressService.getStudentSummary(
        req.user._id,
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error(
      "getStudentSummary error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// STUDENT - RANK
// ======================================================

const getStudentRank = async (
  req,
  res
) => {
  try {
    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const rank =
      await progressService.getStudentRank(
        req.user._id,
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    console.error(
      "getStudentRank error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// STUDENT DASHBOARD
// ======================================================

const getProgressDashboard = async (
  req,
  res
) => {
  try {
    const dashboard =
      await progressService.getProgressDashboard(
        req.user._id,
        req.query.batchId
      );

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error(
      "getProgressDashboard error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentDashboard =
  getProgressDashboard;

// ======================================================
// MENTOR - GET STUDENT PROGRESS
// ======================================================

const getMentorProgress = async (
  req,
  res
) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required",
      });
    }

    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const progress =
      await progressService.getMentorProgress(
        req.user._id,
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error(
      "getMentorProgress error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// MENTOR - AT RISK STUDENTS
// ======================================================

const getFallingBehindStudents =
  async (req, res) => {
    try {
      if (req.user.role !== "mentor") {
        return res.status(403).json({
          success: false,
          message:
            "Mentor access required",
        });
      }

      const {
        type,
        week,
        batchId,
        topic,
        threshold,
      } = req.query;

      const students =
        await progressService.getFallingBehindStudents(
          req.user._id,
          type,
          week,
          batchId,
          topic,
          threshold
        );

      return res.status(200).json({
        success: true,
        data: students,
      });
    } catch (error) {
      console.error(
        "getFallingBehindStudents error:",
        error
      );

      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };

// ======================================================
// ADMIN - OVERALL PROGRESS
// ======================================================

const getOverallProgress = async (
  req,
  res
) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      type,
      week,
      batchId,
      topic,
    } = req.query;

    const progress =
      await progressService.getOverallProgress(
        type,
        week,
        batchId,
        topic
      );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error(
      "getOverallProgress error:",
      error
    );

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// ======================================================
// ADMIN - UNPUBLISH
// ======================================================

const unpublishProgressContent =
  async (req, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message:
            "Admin access required",
        });
      }

      const content =
        await progressService.unpublishProgressContent(
          req.params.contentId
        );

      return res.status(200).json({
        success: true,
        message:
          "Progress content unpublished successfully",
        data: content,
      });
    } catch (error) {
      console.error(
        "unpublishProgressContent error:",
        error
      );

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

  getMentorProgress,
  getFallingBehindStudents,

  getProgressDashboard,
  getStudentDashboard,

  getOverallProgress,
  unpublishProgressContent,
};