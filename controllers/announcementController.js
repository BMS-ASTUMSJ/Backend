const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");
const Batch = require("../models/batch");

// ============================================================
// CREATE ANNOUNCEMENT
// ============================================================

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience = "all", batch, batchId } = req.body;

    // Accept either batch or batchId from frontend
    const selectedBatch = batch || batchId;

    console.log("CREATE ANNOUNCEMENT BODY:", req.body);
    console.log("SELECTED BATCH:", selectedBatch);

    // ========================================================
    // VALIDATE TITLE
    // ========================================================

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    // ========================================================
    // VALIDATE BODY
    // ========================================================

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: "Announcement body is required.",
      });
    }

    // ========================================================
    // VALIDATE AUDIENCE
    // ========================================================

    if (!["all", "mentor"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Audience must be all or mentor.",
      });
    }

    // ========================================================
    // VALIDATE BATCH
    // ========================================================

    if (!selectedBatch) {
      return res.status(400).json({
        success: false,
        message: "Batch is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(selectedBatch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    // ========================================================
    // CHECK BATCH EXISTS
    // ========================================================

    const batchExists = await Batch.findById(selectedBatch);

    if (!batchExists) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    // ========================================================
    // CREATE ANNOUNCEMENT
    // ========================================================

    const announcement = await Announcement.create({
      title: title.trim(),
      body: body.trim(),
      audience,
      batch: selectedBatch,
    });

    // ========================================================
    // POPULATE BATCH
    // ========================================================

    const populatedAnnouncement = await Announcement.findById(
      announcement._id,
    ).populate("batch", "name");

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.status(201).json({
      success: true,
      message: "Announcement published successfully.",
      announcement: populatedAnnouncement,
    });
  } catch (error) {
    console.error("CREATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to publish announcement.",
      error: error.message,
    });
  }
};

// ============================================================
// GET ANNOUNCEMENTS
// ============================================================

const getAnnouncements = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const role = String(req.user.role || "").toLowerCase();

    let filter = {};

    // ========================================================
    // ADMIN
    // ========================================================

    if (role === "admin") {
      filter = {};
    }

    // ========================================================
    // MENTOR
    // ========================================================
    else if (role === "mentor") {
      if (!req.user.batch) {
        return res.status(200).json({
          success: true,
          count: 0,
          announcements: [],
        });
      }

      filter = {
        batch: req.user.batch,
        audience: {
          $in: ["all", "mentor"],
        },
      };
    }

    // ========================================================
    // STUDENT
    // ========================================================
    else if (role === "student") {
      if (!req.user.batch) {
        return res.status(200).json({
          success: true,
          count: 0,
          announcements: [],
        });
      }

      filter = {
        batch: req.user.batch,
        audience: "all",
      };
    }

    // ========================================================
    // INVALID ROLE
    // ========================================================
    else {
      return res.status(403).json({
        success: false,
        message: `Invalid user role: ${role}`,
      });
    }

    const announcements = await Announcement.find(filter)
      .populate("batch", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    console.error("GET ANNOUNCEMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcements.",
      error: error.message,
    });
  }
};

// ============================================================
// GET SINGLE ANNOUNCEMENT
// ============================================================

const getAnnouncement = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const { id } = req.params;
    const role = String(req.user.role || "").toLowerCase();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    const announcement = await Announcement.findById(id)
      .populate("batch", "name")
      .lean();

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    // Admin can see everything
    if (role === "admin") {
      return res.status(200).json({
        success: true,
        announcement,
      });
    }

    // Other users must have a batch
    if (!req.user.batch) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to a batch.",
      });
    }

    // Check batch
    if (
      !announcement.batch ||
      String(announcement.batch._id) !== String(req.user.batch)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this announcement.",
      });
    }

    // Students
    if (role === "student") {
      if (announcement.audience !== "all") {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this announcement.",
        });
      }

      return res.status(200).json({
        success: true,
        announcement,
      });
    }

    // Mentors
    if (role === "mentor") {
      if (!["all", "mentor"].includes(announcement.audience)) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to view this announcement.",
        });
      }

      return res.status(200).json({
        success: true,
        announcement,
      });
    }

    return res.status(403).json({
      success: false,
      message: "Invalid user role.",
    });
  } catch (error) {
    console.error("GET SINGLE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcement.",
      error: error.message,
    });
  }
};

// ============================================================
// UPDATE ANNOUNCEMENT
// ============================================================

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const { title, body, audience, batch, batchId } = req.body;

    const selectedBatch = batch || batchId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required.",
      });
    }

    if (!body || !body.trim()) {
      return res.status(400).json({
        success: false,
        message: "Announcement body is required.",
      });
    }

    if (!["all", "mentor"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Audience must be all or mentor.",
      });
    }

    if (!selectedBatch) {
      return res.status(400).json({
        success: false,
        message: "Batch is required.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(selectedBatch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batchExists = await Batch.findById(selectedBatch);

    if (!batchExists) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        body: body.trim(),
        audience,
        batch: selectedBatch,
      },
      {
        new: true,
        runValidators: true,
      },
    ).populate("batch", "name");

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully.",
      announcement,
    });
  } catch (error) {
    console.error("UPDATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update announcement.",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE ANNOUNCEMENT
// ============================================================

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    const announcement = await Announcement.findByIdAndDelete(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully.",
    });
  } catch (error) {
    console.error("DELETE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete announcement.",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
