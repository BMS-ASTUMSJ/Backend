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
    console.error("createProgressContent error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getProgressContent = async (req, res) => {
  try {
    const { type, week, batchId, topic } = req.query;

    const content = await progressService.getProgressContent(
      type,
      week,
      batchId,
      topic,
    );

    return res.status(200).json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error("getProgressContent error:", error);

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
    console.error("getContentById error:", error);

    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentProgress = async (req, res) => {
  try {
    const { type, week, batchId, topic } = req.query;

    const progress = await progressService.getStudentProgress(
      req.user._id,
      type,
      week,
      batchId,
      topic,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("getStudentProgress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateStudentProgress = async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Student access required",
      });
    }

    const { contentId } = req.params;

    if (!contentId) {
      return res.status(400).json({
        success: false,
        message: "Content ID is required",
      });
    }

    const progress = await progressService.updateStudentProgress(
      req.user._id,
      contentId,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Student progress updated successfully",
      data: progress,
    });
  } catch (error) {
    console.error("updateStudentProgress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentSummary = async (req, res) => {
  try {
    const { type, week, batchId, topic } = req.query;

    const summary = await progressService.getStudentSummary(
      req.user._id,
      type,
      week,
      batchId,
      topic,
    );

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("getStudentSummary error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentRank = async (req, res) => {
  try {
    const { type, week, batchId, topic } = req.query;

    const rank = await progressService.getStudentRank(
      req.user._id,
      type,
      week,
      batchId,
      topic,
    );

    return res.status(200).json({
      success: true,
      data: rank,
    });
  } catch (error) {
    console.error("getStudentRank error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getProgressDashboard = async (req, res) => {
  try {
    const dashboard = await progressService.getProgressDashboard(
      req.user._id,
      req.query.batchId,
    );

    return res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error("getProgressDashboard error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentDashboard = getProgressDashboard;

const getMentorProgress = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required",
      });
    }

    const { type, week, batchId, topic } = req.query;

    const rawResult = await progressService.getMentorProgress(
      req.user._id,
      type,
      week,
      batchId,
      topic,
    );

    let progressList = [];
    let existingStats = null;

    if (Array.isArray(rawResult)) {
      progressList = rawResult;
    } else if (Array.isArray(rawResult?.data)) {
      progressList = rawResult.data;
      existingStats = rawResult.stats;
    } else if (Array.isArray(rawResult?.students)) {
      progressList = rawResult.students;
      existingStats = rawResult.stats;
    } else if (Array.isArray(rawResult?.progress)) {
      progressList = rawResult.progress;
      existingStats = rawResult.stats;
    }

    let completed = 0;
    let inProgress = 0;
    let needHelp = 0;
    let totalCpCompleted = 0;
    let totalCpExpected = 0;
    let totalDevCompleted = 0;
    let totalDevExpected = 0;

    progressList.forEach((s) => {
      const cpDone = Number(
        s?.cp?.completed ?? s?.cpCompleted ?? s?.completedCp ?? 0,
      );
      const cpTot = Number(s?.cp?.total ?? s?.cpTotal ?? s?.totalCp ?? 0);
      const devDone = Number(
        s?.dev?.completed ?? s?.devCompleted ?? s?.completedDev ?? 0,
      );
      const devTot = Number(s?.dev?.total ?? s?.devTotal ?? s?.totalDev ?? 0);

      totalCpCompleted += cpDone;
      totalCpExpected += cpTot;
      totalDevCompleted += devDone;
      totalDevExpected += devTot;

      const totalDone = Number(s?.completed ?? cpDone + devDone);
      const totalExpected = Number(s?.total ?? cpTot + devTot);

      let rate = 0;
      if (s?.completion !== undefined && s?.completion !== null) {
        rate = Number(s.completion);
      } else if (totalExpected > 0) {
        rate = Math.round((totalDone / totalExpected) * 100);
      }

      const status = String(
        s?.status || s?.progressStatus || s?.overallStatus || "",
      ).toLowerCase();

      const isNeedHelp =
        status.includes("need") ||
        status.includes("help") ||
        status === "at_risk" ||
        s?.atRisk === true ||
        s?.student?.atRisk === true ||
        s?.risk?.isAtRisk === true;

      if (rate >= 100 || status === "completed" || status === "done") {
        completed++;
      } else if (isNeedHelp) {
        needHelp++;
      } else if (rate > 0) {
        inProgress++;
      }
    });

    const totalAllExpected = totalCpExpected + totalDevExpected;
    const totalAllDone = totalCpCompleted + totalDevCompleted;
    const overallPercentage =
      totalAllExpected > 0
        ? Math.min(Math.round((totalAllDone / totalAllExpected) * 100), 100)
        : 0;

    const stats = existingStats || {
      completed,
      inProgress,
      needHelp,
      totalCpCompleted,
      totalCpExpected,
      totalDevCompleted,
      totalDevExpected,
      overallPercentage,
    };

    return res.status(200).json({
      success: true,
      stats,
      data: progressList,
    });
  } catch (error) {
    console.error("getMentorProgress error:", error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getFallingBehindStudents = async (req, res) => {
  try {
    if (req.user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required",
      });
    }

    const { type, week, batchId, topic, threshold } = req.query;

    const students = await progressService.getFallingBehindStudents(
      req.user._id,
      type,
      week,
      batchId,
      topic,
      threshold,
    );

    return res.status(200).json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("getFallingBehindStudents error:", error);

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

    const { type, week, batchId, topic } = req.query;

    const progress = await progressService.getOverallProgress(
      type,
      week,
      batchId,
      topic,
    );

    return res.status(200).json({
      success: true,
      data: progress,
    });
  } catch (error) {
    console.error("getOverallProgress error:", error);

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
    console.error("unpublishProgressContent error:", error);

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
