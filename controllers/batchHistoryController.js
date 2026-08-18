const mongoose = require("mongoose");
const User = require("../models/user");
const Batch = require("../models/batch");

const getMyBatchHistory = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("batch", "name status startDate endDate description")
      .populate(
        "batchHistory.batch",
        "name status startDate endDate description",
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const history = (user.batchHistory || [])
      .filter((item) => item.batch)
      .map((item) => ({
        batchId: item.batch._id,
        batch: item.batch,
        role: item.role,
        joinedAt: item.joinedAt,
      }));

    return res.status(200).json({
      success: true,
      currentBatch: user.batch || null,
      currentRole: user.role,
      batchHistory: history,
    });
  } catch (error) {
    console.error("Get my batch history error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching batch history",
    });
  }
};

const getMyBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const user = await User.findById(req.user._id)
      .select("-password")
      .populate(
        "batchHistory.batch",
        "name status startDate endDate description",
      );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const historyItem = user.batchHistory.find(
      (item) => item.batch && item.batch._id.toString() === batchId.toString(),
    );

    if (!historyItem) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this batch",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    return res.status(200).json({
      success: true,

      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
        startDate: batch.startDate,
        endDate: batch.endDate,
        description: batch.description,
      },

      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: user.gender,
        phone: user.phone,
        schoolId: user.schoolId,
        githubUrl: user.githubUrl,
        leetcodeUrl: user.leetcodeUrl,
        codeforcesUrl: user.codeforcesUrl,
        bio: user.bio,
        profileImage: user.profileImage,
      },

      roleInBatch: historyItem.role,
      joinedAt: historyItem.joinedAt,

      // These will be connected when attendance/progress
      // schemas are integrated.
      attendance: [],
      progress: [],
      teams: [],
      assignments: [],
    });
  } catch (error) {
    console.error("Get my batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching batch information",
    });
  }
};

module.exports = {
  getMyBatchHistory,
  getMyBatch,
};
