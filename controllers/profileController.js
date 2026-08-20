const cloudinary = require("../config/cloudinary");
const User = require("../models/user");

// ============================================================
// GET PROFILE
// ============================================================
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password")
      .populate("batch", "name status startDate endDate")
      .populate("batchHistory.batch", "name status startDate endDate");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load profile.",
    });
  }
};

// ============================================================
// UPDATE PROFILE (text fields + optional image, single request)
// ============================================================
const uploadProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { firstName, lastName, phone, bio } = req.body;

    if (firstName !== undefined && firstName.trim()) {
      user.firstName = firstName.trim();
    }

    if (lastName !== undefined && lastName.trim()) {
      user.lastName = lastName.trim();
    }

    if (phone !== undefined) {
      user.phone = phone.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    if (req.file) {
      if (user.profileImage?.publicId) {
        try {
          await cloudinary.uploader.destroy(user.profileImage.publicId);
        } catch (error) {
          console.error("Failed to delete old Cloudinary image:", error);
        }
      }

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "bms-profile-images",
            resource_type: "image",
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );

        stream.end(req.file.buffer);
      });

      user.profileImage = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password")
      .populate("batch", "name status startDate endDate")
      .populate("batchHistory.batch", "name status startDate endDate");

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Profile update error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile.",
    });
  }
};

// ============================================================
// REMOVE PROFILE IMAGE
// ============================================================
const removeProfileImage = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    if (user.profileImage?.publicId) {
      try {
        await cloudinary.uploader.destroy(user.profileImage.publicId);
      } catch (error) {
        console.error("Failed to delete Cloudinary image:", error);
      }
    }

    user.profileImage = {
      url: "",
      publicId: "",
    };

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile image removed successfully.",
      user,
    });
  } catch (error) {
    console.error("Remove profile image error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove profile image.",
    });
  }
};

module.exports = {
  getProfile,
  uploadProfileImage,
  removeProfileImage,
};
