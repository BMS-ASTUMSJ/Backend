const Applicant = require("../models/Applicant");

const registerApplicant = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      gender,
      year,
      department,
      experienceLevel,
      about,
      agreedToRules,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !gender ||
      !year ||
      !department ||
      !experienceLevel ||
      !about
    ) {
      return res.status(400).json({
        success: false,
        message: "Please fill in all required fields",
      });
 }

    if (!agreedToRules) {
      return res.status(400).json({
        success: false,
        message: "You must agree to the bootcamp rules",
      });
    }

    const existingApplicant = await Applicant.findOne({
      email: email.toLowerCase(),
    });

    if (existingApplicant) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered",
      });
    }

    const applicant = await Applicant.create({
      fullName,
      email: email.toLowerCase(),
      phone,
      gender,
      year,
      department,
      experienceLevel,
      about,
      agreedToRules,
    });
  return res.status(201).json({
      success: true,
      message:
        "Registration successful. Your application is pending interview.",
      applicant,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
    });
  }
};

const updateApplicantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["passed", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either passed or rejected",
      });
    }

    const applicant = await Applicant.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Applicant status updated to ${status}`,
      applicant,
    });
  } catch (error) {
    console.error("Update applicant status error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating applicant status",
    });
  }
};

module.exports = {
  registerApplicant,
  updateApplicantStatus,
};