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

    // Only one active batch
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
// 2. GET ALL BATCHES
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
// 3. GET ACTIVE REGISTRATION BATCH
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
// 4. TOGGLE REGISTRATION
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

    // Open registration only for this batch
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
// 5. UPDATE BATCH STATUS
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

    // If making this batch ACTIVE,
    // complete the previous active batch.
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

    // Completed batches cannot have registration open
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
// 6. GET DASHBOARD STATISTICS
// ============================================================

const getBatchDashboardStats = async (req, res) => {
  try {
    const allBatches = await Batch.find().sort({
      createdAt: -1,
    });

    // Current batch is determined by STATUS,
    // not registration.
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

    // ========================================================
    // BATCH HISTORY
    // ========================================================

    const batchHistory = await Promise.all(
      allBatches.map(async (batch) => {
        const [students, teams] = await Promise.all([
          User.find({
            role: "student",
            batch: batch._id,
          }),

          Team.find({
            batch: batch._id,
          }),
        ]);

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

    // ========================================================
    // OVERALL STATISTICS
    // ========================================================

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

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createBatch,
  getBatches,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
  updateBatchStatus,
  getBatchDashboardStats,
};
