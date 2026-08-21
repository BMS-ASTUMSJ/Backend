const mongoose = require("mongoose");

const User = require("../models/user");

const getBatchRole = async (userId, batchId) => {
  const user = await User.findById(userId).select("role batch batchHistory");

  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return "admin";
  }

  const membership = user.batchHistory?.find(
    (history) =>
      history.batch && history.batch.toString() === batchId.toString(),
  );

  if (membership) {
    return membership.role;
  }

  if (user.batch && user.batch.toString() === batchId.toString()) {
    return user.role === "mentor" ? "mentor" : "student";
  }

  return null;
};

const requireBatchAccess = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batchRole = await getBatchRole(req.user._id, batchId);

    if (!batchRole) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this batch.",
      });
    }

    req.batchRole = batchRole;
    req.batchId = batchId;

    next();
  } catch (error) {
    console.error("Batch access error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking batch access.",
    });
  }
};

const requireStudentBatchAccess = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const user = await User.findById(req.user._id).select(
      "role batch batchHistory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role === "admin") {
      req.batchRole = "admin";
      req.batchId = batchId;
      return next();
    }

    const membership = user.batchHistory?.find(
      (history) =>
        history.batch && history.batch.toString() === batchId.toString(),
    );

    if (membership && membership.role === "student") {
      req.batchRole = "student";
      req.batchId = batchId;
      return next();
    }

    if (
      user.batch &&
      user.batch.toString() === batchId.toString() &&
      user.role === "student"
    ) {
      req.batchRole = "student";
      req.batchId = batchId;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You are not a student in this batch.",
    });
  } catch (error) {
    console.error("Student batch access error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking access.",
    });
  }
};

const requireMentorBatchAccess = async (req, res, next) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const user = await User.findById(req.user._id).select(
      "role batch batchHistory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role === "admin") {
      req.batchRole = "admin";
      req.batchId = batchId;
      return next();
    }

    const membership = user.batchHistory?.find(
      (history) =>
        history.batch &&
        history.batch.toString() === batchId.toString() &&
        history.role === "mentor",
    );

    if (membership) {
      req.batchRole = "mentor";
      req.batchId = batchId;
      return next();
    }

    if (
      user.batch &&
      user.batch.toString() === batchId.toString() &&
      user.role === "mentor"
    ) {
      req.batchRole = "mentor";
      req.batchId = batchId;
      return next();
    }

    return res.status(403).json({
      success: false,
      message: "You are not a mentor for this batch.",
    });
  } catch (error) {
    console.error("Mentor batch access error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking access.",
    });
  }
};

module.exports = {
  getBatchRole,
  requireBatchAccess,
  requireStudentBatchAccess,
  requireMentorBatchAccess,
};
