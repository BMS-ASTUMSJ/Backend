const Applicant = require("../models/Applicant");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const { sendEmail } = require("../services/emailService");

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

    const applicant = await Applicant.findById(id);

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found",
      });
    }

    if (status === "rejected") {
      applicant.status = "rejected";
      await applicant.save();

      return res.status(200).json({
        success: true,
        message: "Applicant rejected",
        applicant,
      });
    }

    const existingUser = await User.findOne({
      email: applicant.email,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user account already exists for this applicant",
      });
    }

   
    const nameParts = applicant.fullName.trim().split(/\s+/);

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

  
    const temporaryPassword = crypto.randomBytes(6).toString("base64url");


    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

  
    const student = await User.create({
      firstName,
      lastName,
      email: applicant.email,
      password: hashedPassword,
      role: "student",
      status: "approved",
      mustChangePassword: true,
    });

  
    applicant.status = "passed";
    await applicant.save();

    await sendEmail({
      to: applicant.email,
      subject: "ASTU MSJ Bootcamp - Student Account",
      html: `
        <h2>Congratulations, ${firstName}!</h2>

        <p>
          Your application to the ASTU MSJ Bootcamp has been accepted.
        </p>

        <p>Your student account has been created.</p>

        <p>
          <strong>Email:</strong> ${applicant.email}
        </p>

        <p>
          <strong>Temporary Password:</strong> ${temporaryPassword}
        </p>

        <p>
          Please log in using these credentials and change your password
          immediately.
        </p>

        <p>
          ASTU MSJ Bootcamp Management System
        </p>
      `,
    });

    return res.status(200).json({
      success: true,
      message:
        "Applicant accepted, student account created, and credentials sent by email",
      applicant,
      student: {
        id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        email: student.email,
        role: student.role,
        mustChangePassword: student.mustChangePassword,
      },
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