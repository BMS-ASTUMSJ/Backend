const Applicant = require("../models/applicant");
const User = require("../models/user");
const Batch = require("../models/batch");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

let sendEmail;

try {
  const emailService = require("../services/emailService");
  sendEmail = emailService.sendEmail || emailService;
} catch (e) {
  console.warn("Email service could not be loaded:", e.message);
  sendEmail = null;
}

/* ================================
   REGISTER APPLICANT
================================ */

const registerApplicant = async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      schoolId,
      gender,
      year,
      department,
      experienceLevel,
      githubUrl,
      leetcodeUrl,
      codeforcesUrl,
      about,
      agreedToRules,
      batchId,
    } = req.body;

    // Validate required fields
    if (
      !fullName ||
      !email ||
      !phone ||
      !schoolId ||
      !gender ||
      !year ||
      !department ||
      !experienceLevel ||
      !githubUrl ||
      !leetcodeUrl ||
      !codeforcesUrl ||
      !about
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Please fill in all required fields (including School ID, GitHub, LeetCode, and Codeforces)",
      });
    }

    // Check agreement
    if (!agreedToRules) {
      return res.status(400).json({
        success: false,
        message: "You must agree to the bootcamp rules",
      });
    }

    let targetBatch;

    // Find selected batch
    if (batchId) {
      targetBatch = await Batch.findById(batchId);
    } else {
      // Find an open registration batch
      targetBatch = await Batch.findOne({
        isRegistrationOpen: true,
      });
    }

    if (!targetBatch) {
      return res.status(400).json({
        success: false,
        message:
          "Registration is currently closed or no active batch was found.",
      });
    }

    if (!targetBatch.isRegistrationOpen) {
      return res.status(400).json({
        success: false,
        message: `Registration for ${targetBatch.name} is currently closed.`,
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check existing applicant
    const existingApplicant = await Applicant.findOne({
      email: normalizedEmail,
    });

    if (existingApplicant) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered as an applicant",
      });
    }

    // Create applicant
    const applicant = await Applicant.create({
      fullName: fullName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      schoolId: schoolId.trim(),
      gender,
      year,
      department: department.trim(),
      experienceLevel,
      githubUrl: githubUrl.trim(),
      leetcodeUrl: leetcodeUrl.trim(),
      codeforcesUrl: codeforcesUrl.trim(),
      about: about.trim(),
      agreedToRules,
      batch: targetBatch._id,
      status: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Registration successful. Your application is pending review.",
      applicant,
    });
  } catch (error) {
    console.error("Registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during registration",
      error: error.message,
    });
  }
};

/* ================================
   GET APPLICANTS
================================ */

const getApplicants = async (req, res) => {
  try {
    const { gender, batchId, status } = req.query;

    const filter = {};

    if (gender) {
      filter.gender = gender;
    }

    if (batchId) {
      filter.batch = batchId;
    }

    if (status) {
      filter.status = status;
    }

    const applicants = await Applicant.find(filter)
      .populate("batch", "name isRegistrationOpen")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: applicants.length,
      applicants,
    });
  } catch (error) {
    console.error("Get applicants error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting applicants",
      error: error.message,
    });
  }
};

/* ================================
   UPDATE APPLICANT STATUS
================================ */

const updateApplicantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!["passed", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be either 'passed' or 'rejected'",
      });
    }

    // Find applicant
    const applicant = await Applicant.findById(id);

    if (!applicant) {
      return res.status(404).json({
        success: false,
        message: "Applicant not found",
      });
    }

    /* ================================
       REJECT APPLICANT
    ================================ */

    if (status === "rejected") {
      // IMPORTANT:
      // Don't use applicant.save() here.
      // Old applicants may not have newly required fields.

      const updatedApplicant = await Applicant.findByIdAndUpdate(
        id,
        {
          $set: {
            status: "rejected",
          },
        },
        {
          new: true,
          runValidators: false,
        },
      );

      return res.status(200).json({
        success: true,
        message: "Applicant rejected",
        applicant: updatedApplicant,
      });
    }

    /* ================================
       ACCEPT / PASS APPLICANT
    ================================ */

    const normalizedEmail = applicant.email.toLowerCase().trim();

    // Check whether user already exists
    let user = await User.findOne({
      email: normalizedEmail,
    });

    /* ================================
       USER ALREADY EXISTS
    ================================ */

    if (user) {
      // Update only applicant status.
      // This avoids validating missing fields in old applicant documents.
      const updatedApplicant = await Applicant.findByIdAndUpdate(
        id,
        {
          $set: {
            status: "passed",
          },
        },
        {
          new: true,
          runValidators: false,
        },
      );

      return res.status(200).json({
        success: true,
        message:
          "Applicant accepted! Student account is already active in the database.",
        applicant: updatedApplicant,
        student: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          gender: user.gender,
          schoolId: user.schoolId,
          githubUrl: user.githubUrl,
          leetcodeUrl: user.leetcodeUrl,
          codeforcesUrl: user.codeforcesUrl,
          batch: user.batch,
          role: user.role,
        },
        emailSent: false,
      });
    }

    /* ================================
       CREATE NEW STUDENT ACCOUNT
    ================================ */

    const nameParts = (applicant.fullName || "Student User")
      .trim()
      .split(/\s+/);

    const firstName = nameParts[0] || "Student";

    const lastName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : "User";

    // Generate temporary password
    const temporaryPassword = crypto.randomBytes(4).toString("hex") + "Aa1!";

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // Create student account
    user = await User.create({
      firstName,
      lastName,
      email: normalizedEmail,
      phone: applicant.phone || "",
      schoolId: applicant.schoolId || "",
      githubUrl: applicant.githubUrl || "",
      leetcodeUrl: applicant.leetcodeUrl || "",
      codeforcesUrl: applicant.codeforcesUrl || "",
      gender: applicant.gender || "Female",
      batch: applicant.batch || null,
      password: hashedPassword,
      role: "student",
      status: "approved",
      mustChangePassword: true,
    });

    // IMPORTANT:
    // Update ONLY the applicant status.
    // Do not use applicant.save().
    const updatedApplicant = await Applicant.findByIdAndUpdate(
      id,
      {
        $set: {
          status: "passed",
        },
      },
      {
        new: true,
        runValidators: false,
      },
    );

    /* ================================
       SEND EMAIL
    ================================ */

    let emailSent = false;

    if (sendEmail && typeof sendEmail === "function") {
      try {
        await sendEmail({
          to: normalizedEmail,
          subject: "ASTU MSJ Bootcamp - Student Account",
          html: `
            <h2>Congratulations, ${firstName}!</h2>

            <p>
              Your application to the ASTU MSJ Bootcamp
              has been accepted.
            </p>

            <p>Your student account has been created.</p>

            <p>
              <strong>Email:</strong>
              ${normalizedEmail}
            </p>

            <p>
              <strong>Temporary Password:</strong>
              ${temporaryPassword}
            </p>

            <p>
              Please log in and change your password immediately.
            </p>

            <p>
              ASTU MSJ Bootcamp Management System
            </p>
          `,
        });

        emailSent = true;
      } catch (emailErr) {
        console.warn("Email service failed:", emailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: emailSent
        ? "Applicant accepted and student account created successfully. The temporary password has been sent to the student's email."
        : "Applicant accepted and student account created successfully, but the temporary password could not be sent to the student's email.",

      applicant: updatedApplicant,

      student: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        schoolId: user.schoolId,
        githubUrl: user.githubUrl,
        leetcodeUrl: user.leetcodeUrl,
        codeforcesUrl: user.codeforcesUrl,
        gender: user.gender,
        batch: user.batch,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },

      emailSent,
    });
  } catch (error) {
    console.error("Update applicant status error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating applicant status",
      error: error.message,
    });
  }
};

module.exports = {
  registerApplicant,
  updateApplicantStatus,
  getApplicants,
};
