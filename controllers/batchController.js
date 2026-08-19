const Batch = require("../models/Batch");

// ======================================================
// CREATE BATCH
// ADMIN ONLY
// ======================================================
const createBatch = async (req, res) => {
  try {
    const {
      name,
      startDate,
      endDate,
      status = "upcoming",
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required.",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required.",
      });
    }

    const existingBatch = await Batch.findOne({
      name: name.trim(),
    });

    if (existingBatch) {
      return res.status(409).json({
        success: false,
        message: "A batch with this name already exists.",
      });
    }

    const batch = await Batch.create({
      name: name.trim(),
      startDate,
      endDate: endDate || null,
      status,
    });

    return res.status(201).json({
      success: true,
      message: "Batch created successfully.",
      batch,
    });
  } catch (error) {
    console.error("Create batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating batch.",
      error: error.message,
    });
  }
};

// ======================================================
// GET ALL BATCHES
// ======================================================
const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      startDate: -1,
    });

    return res.status(200).json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("Get batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batches.",
      error: error.message,
    });
  }
};

// ======================================================
// GET BATCH STATISTICS
// ======================================================
const getBatchStats = async (req, res) => {
  try {
    const totalBatches = await Batch.countDocuments();

    const upcomingBatches = await Batch.countDocuments({
      status: "upcoming",
    });

    const activeBatches = await Batch.countDocuments({
      status: "active",
    });

    const completedBatches = await Batch.countDocuments({
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalBatches,
        upcomingBatches,
        activeBatches,
        completedBatches,
      },
    });
  } catch (error) {
    console.error("Get batch stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch statistics.",
      error: error.message,
    });
  }
};

// ======================================================
// GET ONE BATCH
// ======================================================
const getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    return res.status(200).json({
      success: true,
      batch,
    });
  } catch (error) {
    console.error("Get batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch.",
      error: error.message,
    });
  }
};

// ======================================================
// UPDATE BATCH
// ADMIN ONLY
// ======================================================
const updateBatch = async (req, res) => {
  try {
    const {
      name,
      startDate,
      endDate,
      status,
    } = req.body;

    const batch = await Batch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Batch name cannot be empty.",
        });
      }

      batch.name = name.trim();
    }

    if (startDate !== undefined) {
      batch.startDate = startDate;
    }

    if (endDate !== undefined) {
      batch.endDate = endDate || null;
    }

    if (status !== undefined) {
      if (
        !["upcoming", "active", "completed"].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch status.",
        });
      }

      batch.status = status;
    }

    await batch.save();

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully.",
      batch,
    });
  } catch (error) {
    console.error("Update batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating batch.",
      error: error.message,
    });
  }
};


module.exports = {
  createBatch,
  getBatches,
  getBatchStats,
  getBatchById,
  updateBatch,
};