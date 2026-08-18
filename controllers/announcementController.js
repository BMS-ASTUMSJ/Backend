const mongoose = require("mongoose");
const Announcement = require("../models/Announcement");

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience = "all" } = req.body;

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
        message: "Audience must be either all or mentor.",
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      body: body.trim(),
      audience,
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created successfully.",
      announcement,
    });
  } catch (error) {
    console.error("CREATE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create announcement.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    let filter = {};

    if (req.user.role === "student") {
      filter = {
        audience: "all",
      };
    } else if (req.user.role === "mentor") {
      filter = {
        audience: {
          $in: ["all", "mentor"],
        },
      };
    } else if (req.user.role === "admin") {
      filter = {};
    } else {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    const announcements = await Announcement.find(filter)
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
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const getAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated.",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    if (req.user.role === "student" && announcement.audience !== "all") {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this announcement.",
      });
    }

    if (
      req.user.role === "mentor" &&
      !["all", "mentor"].includes(announcement.audience)
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this announcement.",
      });
    }

    if (!["student", "mentor", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Invalid user role.",
      });
    }

    return res.status(200).json({
      success: true,
      announcement,
    });
  } catch (error) {
    console.error("GET SINGLE ANNOUNCEMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch announcement.",
    });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, audience } = req.body;

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
        message: "Audience must be either all or mentor.",
      });
    }

    const announcement = await Announcement.findByIdAndUpdate(
      id,
      {
        title: title.trim(),
        body: body.trim(),
        audience,
      },
      {
        new: true,
        runValidators: true,
      },
    );

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
    });
  }
};

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
    });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
};
