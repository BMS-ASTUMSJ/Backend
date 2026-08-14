const Announcement = require("../models/Announcement");

const createAnnouncement = async (req, res) => {
  try {
    const { title, body, audience } = req.body;

    if (!title || !body || !audience) {
      return res.status(400).json({
        success: false,
        message: "Title, body, and audience are required",
      });
    }

    if (!["all", "mentor"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Audience must be either all or mentor",
      });
    }

    const announcement = await Announcement.create({
      title,
      body,
      audience,
     
    });

    return res.status(201).json({
      success: true,
      message: "Announcement created successfully",
      announcement,
    });
  } catch (error) {
    console.error("Create announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
const getAnnouncements = async (req, res) => {
  try {
    let filter = {};

    
    if (req.user.role === "student") {
      filter = {
        audience: "all",
      };
    }


    if (req.user.role === "mentor") {
      filter = {
        audience: { $in: ["all", "mentor"] },
      };
    }

    if (req.user.role === "admin") {
      filter = {};
    }

    const announcements = await Announcement.find(filter)
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
    });
  } catch (error) {
    console.error("Get announcements error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    await Announcement.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Announcement deleted successfully",
    });
  } catch (error) {
    console.error("Delete announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body, audience } = req.body;

    if (!title || !body || !audience) {
      return res.status(400).json({
        success: false,
        message: "Title, body, and audience are required",
      });
    }

    if (!["all", "mentor"].includes(audience)) {
      return res.status(400).json({
        success: false,
        message: "Audience must be either all or mentor",
      });
    }

    const announcement = await Announcement.findById(id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: "Announcement not found",
      });
    }

    announcement.title = title;
    announcement.body = body;
    announcement.audience = audience;

    await announcement.save();

    return res.status(200).json({
      success: true,
      message: "Announcement updated successfully",
      announcement,
    });
  } catch (error) {
    console.error("Update announcement error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
  updateAnnouncement,
};