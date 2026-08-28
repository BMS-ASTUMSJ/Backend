const mongoose = require("mongoose");
const Announcement = require("../models/announcement");
const User = require("../models/user");

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience = "all" } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!["admin", "mentor"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to create announcements.",
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
        message: "Announcement message is required.",
      });
    }

    const validAudiences = ["all", "mentor", "assigned_students"];

    if (!validAudiences.includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement audience.",
      });
    }

    if (
      req.user.role === "mentor" &&
      !["all", "mentor", "assigned_students"].includes(audience)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid audience for mentor announcement.",
      });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      body: body.trim(),
      audience,
      createdBy: req.user._id,
    });

    await announcement.populate("createdBy", "firstName lastName email role");

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
      error: error.message,
    });
  }
};

const getAnnouncements = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userId = req.user._id;
    const userRole = req.user.role;

    let filter;

    if (userRole === "admin") {
      const adminUsers = await User.find({
        role: "admin",
      }).select("_id");

      const adminIds = adminUsers.map((admin) => admin._id);

      filter = {
        createdBy: {
          $in: adminIds,
        },
      };
    } else if (userRole === "mentor") {
      const adminUsers = await User.find({
        role: "admin",
      }).select("_id");

      const adminIds = adminUsers.map((admin) => admin._id);

      filter = {
        $or: [
          {
            createdBy: {
              $in: adminIds,
            },
            audience: "all",
          },

          {
            createdBy: {
              $in: adminIds,
            },
            audience: "mentor",
          },

          {
            createdBy: userId,
          },
        ],
      };
    } else if (userRole === "student") {
      const mentors = await User.find({
        role: "mentor",
        assignedStudents: userId,
      }).select("_id");

      const mentorIds = mentors.map((mentor) => mentor._id);

      filter = {
        $or: [
          {
            audience: "all",
          },

          {
            audience: "assigned_students",
            createdBy: {
              $in: mentorIds,
            },
          },
        ],
      };
    } else {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view announcements.",
      });
    }

    const announcements = await Announcement.find(filter)
      .populate("createdBy", "firstName lastName email role")
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
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

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, audience } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!["admin", "mentor"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to update announcements.",
      });
    }

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
        message: "Announcement message is required.",
      });
    }

    const validAudiences = ["all", "mentor", "assigned_students"];

    if (!validAudiences.includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement audience.",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const creatorId = announcement.createdBy.toString();
    const currentUserId = req.user._id.toString();

    if (req.user.role === "admin") {
      const creator = await User.findById(announcement.createdBy).select(
        "role",
      );

      if (!creator) {
        return res.status(404).json({
          success: false,
          message: "Announcement creator not found.",
        });
      }

      if (creator.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admins can only edit announcements created by admins.",
        });
      }
    }

    if (req.user.role === "mentor") {
      if (creatorId !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "You can only edit announcements that you created.",
        });
      }
    }

    announcement.title = title.trim();
    announcement.body = body.trim();
    announcement.audience = audience;

    announcement.edited = true;

    await announcement.save();

    await announcement.populate("createdBy", "firstName lastName email role");

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

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!["admin", "mentor"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to delete announcements.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid announcement ID.",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found.",
      });
    }

    const creatorId = announcement.createdBy.toString();
    const currentUserId = req.user._id.toString();

    if (req.user.role === "admin") {
      const creator = await User.findById(announcement.createdBy).select(
        "role",
      );

      if (!creator) {
        return res.status(404).json({
          success: false,
          message: "Announcement creator not found.",
        });
      }

      if (creator.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admins can only delete announcements created by admins.",
        });
      }
    }

    if (req.user.role === "mentor") {
      if (creatorId !== currentUserId) {
        return res.status(403).json({
          success: false,
          message: "You can only delete announcements that you created.",
        });
      }
    }

    await Announcement.findByIdAndDelete(id);

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

module.exports = {
  createAnnouncement,
  getAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
};
