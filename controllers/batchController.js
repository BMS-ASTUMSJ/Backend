const mongoose = require("mongoose");

const Batch = require("../models/batch");
const User = require("../models/user");
const Team = require("../models/team");
const Applicant = require("../models/applicant");

// ============================================================
// 1. CREATE BATCH
// ============================================================

const createBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, description, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required.",
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

    const batchStatus = status || "upcoming";

    if (!["upcoming", "active", "completed"].includes(batchStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'upcoming', 'active', or 'completed'.",
      });
    }

    if (batchStatus === "active") {
      await Batch.updateMany(
        { status: "active" },
        {
          $set: {
            status: "completed",
            isRegistrationOpen: false,
          },
        },
      );
    }

    const batch = await Batch.create({
      name: name.trim(),
      startDate,
      endDate,
      description,
      status: batchStatus,
      isRegistrationOpen: false,
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

// ============================================================
// 2. GET ALL BATCHES - ADMIN
// ============================================================

const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: batches.length,
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

// ============================================================
// 3. GET MY BATCHES
//
// Admin:
//     gets all batches
//
// Student/Mentor:
//     gets only batches found in batchHistory
// ============================================================

const getMyBatches = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "role batch batchHistory",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Admin can see every batch.
    if (user.role === "admin") {
      const batches = await Batch.find().sort({
        createdAt: -1,
      });

      return res.status(200).json({
        success: true,
        batches: batches.map((batch) => ({
          batch,
          role: "admin",
        })),
      });
    }

    const history = user.batchHistory || [];

    const batchIds = history.map((item) => item.batch).filter(Boolean);

    // Backward compatibility for existing users.
    if (
      user.batch &&
      !batchIds.some((id) => id.toString() === user.batch.toString())
    ) {
      batchIds.push(user.batch);
    }

    const batches = await Batch.find({
      _id: { $in: batchIds },
    }).sort({
      createdAt: -1,
    });

    const result = batches.map((batch) => {
      const membership = history.find(
        (item) => item.batch && item.batch.toString() === batch._id.toString(),
      );

      let role = membership?.role || null;

      // Backward compatibility.
      if (!role && user.batch) {
        if (user.batch.toString() === batch._id.toString()) {
          role = user.role === "mentor" ? "mentor" : "student";
        }
      }

      return {
        batch,
        role,
      };
    });

    return res.status(200).json({
      success: true,
      batches: result,
    });
  } catch (error) {
    console.error("Get my batches error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching your batches.",
      error: error.message,
    });
  }
};

// ============================================================
// 4. GET ONE OF MY BATCHES
// ============================================================

const getMyBatch = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    // Admin can access every batch.
    if (user.role === "admin") {
      return res.status(200).json({
        success: true,
        batch,
        role: "admin",
      });
    }

    const membership = user.batchHistory?.find(
      (item) => item.batch && item.batch.toString() === id,
    );

    if (membership) {
      return res.status(200).json({
        success: true,
        batch,
        role: membership.role,
      });
    }

    // Backward compatibility.
    if (user.batch && user.batch.toString() === id) {
      return res.status(200).json({
        success: true,
        batch,
        role: user.role === "mentor" ? "mentor" : "student",
      });
    }

    return res.status(403).json({
      success: false,
      message: "You do not have access to this batch.",
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

// ============================================================
// 5. GET ACTIVE REGISTRATION BATCH
// ============================================================

const getActiveRegistrationBatch = async (req, res) => {
  try {
    const activeBatch = await Batch.findOne({
      isRegistrationOpen: true,
    });

    return res.status(200).json({
      success: true,
      isRegistrationOpen: !!activeBatch,
      activeBatch: activeBatch || null,
    });
  } catch (error) {
    console.error("Get active registration batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while checking registration status.",
      error: error.message,
    });
  }
};

// ============================================================
// 6. TOGGLE REGISTRATION
// ============================================================

const toggleBatchRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    const newRegistrationStatus = !batch.isRegistrationOpen;

    if (newRegistrationStatus === true) {
      await Batch.updateMany(
        {
          _id: { $ne: id },
          isRegistrationOpen: true,
        },
        {
          $set: {
            isRegistrationOpen: false,
          },
        },
      );
    }

    batch.isRegistrationOpen = newRegistrationStatus;

    await batch.save();

    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: `Registration for "${batch.name}" is now ${
        newRegistrationStatus ? "OPEN" : "CLOSED"
      }.`,
      batch,
      batches,
    });
  } catch (error) {
    console.error("Toggle registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating registration status.",
      error: error.message,
    });
  }
};

// ============================================================
// 7. UPDATE BATCH STATUS
// ============================================================

const updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID.",
      });
    }

    if (!["upcoming", "active", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'upcoming', 'active', or 'completed'.",
      });
    }

    const batch = await Batch.findById(id);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found.",
      });
    }

    if (status === "active") {
      await Batch.updateMany(
        {
          _id: { $ne: id },
          status: "active",
        },
        {
          $set: {
            status: "completed",
            isRegistrationOpen: false,
          },
        },
      );
    }

    if (status === "completed") {
      batch.isRegistrationOpen = false;
    }

    batch.status = status;

    await batch.save();

    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      message: `Batch "${batch.name}" status updated to ${status}.`,
      batch,
      batches,
    });
  } catch (error) {
    console.error("Update batch status error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating batch status.",
      error: error.message,
    });
  }
};

// ============================================================
// 8. GET DASHBOARD STATISTICS
// ============================================================

const getBatchDashboardStats = async (req, res) => {
  try {
    const allBatches = await Batch.find().sort({
      createdAt: -1,
    });

    const activeBatch =
      allBatches.find((batch) => batch.status === "active") || null;

    let currentBatchStats = {
      batch: null,
      studentCount: 0,
      femaleStudents: 0,
      maleStudents: 0,
      mentorCount: 0,
      teamCount: 0,
      applicantCount: 0,
    };

    if (activeBatch) {
      const [students, mentors, teams, applicants] = await Promise.all([
        User.find({
          role: "student",
          batch: activeBatch._id,
        }),

        User.find({
          role: "mentor",
          batch: activeBatch._id,
        }),

        Team.find({
          batch: activeBatch._id,
        }),

        Applicant.find({
          batch: activeBatch._id,
        }),
      ]);

      currentBatchStats = {
        batch: activeBatch,

        studentCount: students.length,

        femaleStudents: students.filter(
          (student) => student.gender === "Female",
        ).length,

        maleStudents: students.filter((student) => student.gender === "Male")
          .length,

        mentorCount: mentors.length,

        teamCount: teams.length,

        applicantCount: applicants.length,
      };
    }

    const batchHistory = await Promise.all(
      allBatches.map(async (batch) => {
        const students = await User.find({
          $or: [
            {
              role: "student",
              batch: batch._id,
            },
            {
              batchHistory: {
                $elemMatch: {
                  batch: batch._id,
                  role: "student",
                },
              },
            },
          ],
        });

        const teams = await Team.find({
          batch: batch._id,
        });

        return {
          _id: batch._id,
          name: batch.name,
          status: batch.status,
          isRegistrationOpen: batch.isRegistrationOpen,
          startDate: batch.startDate,
          endDate: batch.endDate,
          description: batch.description,

          totalStudents: students.length,

          femaleStudents: students.filter(
            (student) => student.gender === "Female",
          ).length,

          maleStudents: students.filter((student) => student.gender === "Male")
            .length,

          totalTeams: teams.length,
        };
      }),
    );

    const [totalStudentsAllTime, totalMentors, totalApplicants] =
      await Promise.all([
        User.countDocuments({
          role: "student",
        }),

        User.countDocuments({
          role: "mentor",
        }),

        Applicant.countDocuments(),
      ]);

    const previousBatches = batchHistory.filter(
      (batch) => batch._id.toString() !== activeBatch?._id?.toString(),
    );

    return res.status(200).json({
      success: true,

      currentBatch: currentBatchStats,

      previousBatches,

      allBatches: batchHistory,

      overallStats: {
        totalBatches: allBatches.length,
        totalStudentsAllTime,
        totalMentors,
        totalApplicants,
      },
    });
  } catch (error) {
    console.error("Get batch dashboard stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch dashboard statistics.",
      error: error.message,
    });
  }
};

module.exports = {
  createBatch,
  getBatches,
  getMyBatches,
  getMyBatch,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
  updateBatchStatus,
  getBatchDashboardStats,
};
