const mongoose = require("mongoose");
const User = require("../models/user");
const Batch = require("../models/batch");
const Team = require("../models/team");

const getMyBatchHistory = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const user = await User.findById(userId).select(
      "role batch batchHistory firstName lastName email",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required.",
      });
    }

    let currentBatch = null;
    let currentRole = "mentor";

    if (user.batch) {
      currentBatch = await Batch.findById(user.batch).lean();

      if (currentBatch) {
        currentRole = "mentor";
      }
    }

    const history = Array.isArray(user.batchHistory) ? user.batchHistory : [];

    const historyBatchIds = history
      .map((item) => item?.batch)
      .filter(Boolean)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (
      user.batch &&
      mongoose.Types.ObjectId.isValid(user.batch) &&
      !historyBatchIds.some((id) => id.toString() === user.batch.toString())
    ) {
      historyBatchIds.push(user.batch);
    }

    let batches = [];

    if (historyBatchIds.length > 0) {
      batches = await Batch.find({
        _id: {
          $in: historyBatchIds,
        },
      })
        .sort({
          startDate: -1,
          createdAt: -1,
        })
        .lean();
    }

    const batchHistory = batches.map((batch) => {
      const historyItem = history.find(
        (item) => item?.batch && item.batch.toString() === batch._id.toString(),
      );

      return {
        batchId: batch._id,
        batch,
        role: historyItem?.role || "mentor",
        joinedAt: historyItem?.joinedAt || null,
        leftAt: historyItem?.leftAt || null,
      };
    });

    const previousBatches = batchHistory.filter((item) => {
      if (!currentBatch?._id) {
        return true;
      }

      return item.batchId.toString() !== currentBatch._id.toString();
    });

    return res.status(200).json({
      success: true,
      currentBatch,
      currentRole,
      batchHistory: previousBatches,
    });
  } catch (error) {
    console.error("Get my batch history error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching your batch history.",
      error: error.message,
    });
  }
};

const getMyBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
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

    if (user.role !== "mentor") {
      return res.status(403).json({
        success: false,
        message: "Mentor access required.",
      });
    }

    const batch = await Batch.findById(batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const isCurrentBatch = user.batch && user.batch.toString() === batchId;

    const historyItem = Array.isArray(user.batchHistory)
      ? user.batchHistory.find(
          (item) => item?.batch && item.batch.toString() === batchId,
        )
      : null;

    if (!isCurrentBatch && !historyItem) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this batch.",
      });
    }

    const teams = await Team.find({
      batch: batchId,
      mentors: req.user._id,
    })
      .populate("mentors", "firstName lastName email profileImage")
      .populate("members", "firstName lastName email gender profileImage")
      .lean();

    return res.status(200).json({
      success: true,
      batch,
      role: historyItem?.role || "mentor",
      joinedAt: historyItem?.joinedAt || null,
      leftAt: historyItem?.leftAt || null,
      isCurrentBatch,
      teams,
    });
  } catch (error) {
    console.error("Get my batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch.",
      error: error.message,
    });
  }
};

const getAllBatchesForAdmin = async (req, res) => {
  try {
    const batches = await Batch.find()
      .sort({
        startDate: -1,
        createdAt: -1,
      })
      .lean();

    return res.status(200).json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("Get all batches for admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batches.",
      error: error.message,
    });
  }
};

const getBatchMembersForAdmin = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(batchId).lean();

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const students = await User.find({
      $or: [
        {
          role: "student",
          batch: batchId,
        },
        {
          batchHistory: {
            $elemMatch: {
              batch: batchId,
              role: "student",
            },
          },
        },
      ],
    })
      .select(
        "firstName lastName email role gender phone profileImage batch batchHistory",
      )
      .lean();

    const mentors = await User.find({
      $or: [
        {
          role: "mentor",
          batch: batchId,
        },
        {
          batchHistory: {
            $elemMatch: {
              batch: batchId,
              role: "mentor",
            },
          },
        },
      ],
    })
      .select(
        "firstName lastName email role gender phone profileImage batch batchHistory",
      )
      .lean();

    const teams = await Team.find({
      batch: batchId,
    })
      .populate("mentors", "firstName lastName email profileImage")
      .populate("members", "firstName lastName email gender profileImage")
      .lean();

    return res.status(200).json({
      success: true,
      batch,
      students,
      mentors,
      teams,
      studentCount: students.length,
      mentorCount: mentors.length,
      teamCount: teams.length,
    });
  } catch (error) {
    console.error("Get batch members for admin error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch members.",
      error: error.message,
    });
  }
};

module.exports = {
  getMyBatchHistory,
  getMyBatch,
  getAllBatchesForAdmin,
  getBatchMembersForAdmin,
};
