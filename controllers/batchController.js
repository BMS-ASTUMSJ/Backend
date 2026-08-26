const mongoose = require("mongoose");
const Batch = require("../models/batch");
const User = require("../models/user");
const Team = require("../models/team");
const Applicant = require("../models/applicant");
const Attendance = require("../models/attendance");
const Assignment = require("../models/assignment");

let Submission = null;
try {
  Submission = mongoose.model("Submission");
} catch {
  try {
    Submission = require("../models/submission");
  } catch (e) {
    Submission = null;
  }
}

const createBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, status = "upcoming", description = "" } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required.",
      });
    }

    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: "Start date is required.",
      });
    }

    if (!["upcoming", "active", "completed"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be 'upcoming', 'active', or 'completed'.",
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

    if (status === "active") {
      await Batch.updateMany(
        { status: "active" },
        {
          $set: {
            status: "completed",
            isRegistrationOpen: false,
          },
        }
      );
    }

    const batch = await Batch.create({
      name: name.trim(),
      startDate,
      endDate: endDate || null,
      description: description.trim(),
      status,
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

const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      startDate: -1,
    });

    return res.status(200).json({
      success: true,
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

const getMyBatches = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "role batch batchHistory"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

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
        (item) => item.batch && item.batch.toString() === batch._id.toString()
      );

      let role = membership?.role || null;

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
      "role batch batchHistory"
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

    if (user.role === "admin") {
      return res.status(200).json({
        success: true,
        batch,
        role: "admin",
      });
    }

    const membership = user.batchHistory?.find(
      (item) => item.batch && item.batch.toString() === id
    );

    if (membership) {
      return res.status(200).json({
        success: true,
        batch,
        role: membership.role,
      });
    }

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

const getActiveRegistrationBatch = async (req, res) => {
  try {
    const activeBatch = await Batch.findOne({
      status: "active",
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

    if (batch.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Only an active batch can have registration open.",
      });
    }

    const newRegistrationStatus = !batch.isRegistrationOpen;

    if (newRegistrationStatus) {
      await Batch.updateMany(
        {
          _id: { $ne: id },
          isRegistrationOpen: true,
        },
        {
          $set: {
            isRegistrationOpen: false,
          },
        }
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
        message: "Batch status must be 'upcoming', 'active', or 'completed'.",
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
        }
      );
    }

    if (status !== "active") {
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
          (student) => student.gender === "Female"
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
            (student) => student.gender === "Female"
          ).length,
          maleStudents: students.filter((student) => student.gender === "Male")
            .length,
          totalTeams: teams.length,
        };
      })
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
      (batch) => batch._id.toString() !== activeBatch?._id?.toString()
    );

    let attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
    };

    try {
      const attendanceQuery = activeBatch ? { batchId: activeBatch._id } : {};
      const attendances = await Attendance.find(attendanceQuery).select(
        "firstCheck secondCheck"
      );

      attendances.forEach((rec) => {
        if (rec.firstCheck?.status === "Present") attendanceStats.present++;
        if (rec.firstCheck?.status === "Absent") attendanceStats.absent++;
        if (rec.firstCheck?.status === "Late") attendanceStats.late++;

        if (rec.secondCheck?.status === "Present") attendanceStats.present++;
        if (rec.secondCheck?.status === "Absent") attendanceStats.absent++;
        if (rec.secondCheck?.status === "Late") attendanceStats.late++;
      });
    } catch (attErr) {
      console.error("Attendance stats computation error:", attErr);
    }

    let assignmentStats = {
      completed: 0,
      pending: 0,
      overdue: 0,
    };

    try {
      const assignmentQuery = activeBatch ? { batch: activeBatch._id } : {};
      const batchAssignments = await Assignment.find(assignmentQuery).select("_id deadline");

      if (Submission) {
        const assignmentIds = batchAssignments.map((a) => a._id);
        const subQuery = assignmentIds.length > 0 ? { assignment: { $in: assignmentIds } } : {};
        const submissions = await Submission.find(subQuery).select("status assignment");

        assignmentStats.completed = submissions.filter(
          (s) => s.status === "Graded"
        ).length;
        assignmentStats.pending = submissions.filter(
          (s) => s.status === "Pending"
        ).length;
        assignmentStats.overdue = submissions.filter(
          (s) => s.status === "Resubmission Required"
        ).length;
      }
    } catch (asgErr) {
      console.error("Assignment stats computation error:", asgErr);
    }

    let recentActivity = [];
    try {
      const [recentApplicants, recentUsers] = await Promise.all([
        Applicant.find()
          .sort({ createdAt: -1 })
          .limit(3)
          .select("fullName email createdAt"),
        User.find()
          .sort({ createdAt: -1 })
          .limit(3)
          .select("firstName lastName role createdAt"),
      ]);

      const applicantActivities = recentApplicants.map((app) => ({
        _id: app._id,
        message: `New applicant registered: ${app.fullName}`,
        createdAt: app.createdAt,
      }));

      const userActivities = recentUsers.map((u) => ({
        _id: u._id,
        message: `${u.role.toUpperCase()} registered: ${u.firstName} ${u.lastName}`,
        createdAt: u.createdAt,
      }));

      recentActivity = [...applicantActivities, ...userActivities]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 6);
    } catch (actErr) {
      console.error("Recent activity computation error:", actErr);
    }

    return res.status(200).json({
      success: true,
      currentBatch: currentBatchStats,
      previousBatches,
      allBatches: batchHistory,
      attendanceStats,
      assignmentStats,
      recentActivity,
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
      message: "Server error while fetching batch statistics.",
      error: error.message,
    });
  }
};

const getBatchStats = async (req, res) => {
  try {
    const totalBatches = await Batch.countDocuments();
    const upcomingBatches = await Batch.countDocuments({
      status: "upcoming",
    });
    const activeBatches = await Batch.countDocuments({
      status: "active",
    });
    const completedBatches = await Batch.countDocuments({
      status: "completed",
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalBatches,
        upcomingBatches,
        activeBatches,
        completedBatches,
      },
    });
  } catch (error) {
    console.error("Get batch stats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch statistics.",
      error: error.message,
    });
  }
};

const getBatchById = async (req, res) => {
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

    const students = await User.find({
      $or: [
        {
          role: "student",
          batch: id,
        },
        {
          batchHistory: {
            $elemMatch: {
              batch: id,
              role: "student",
            },
          },
        },
      ],
    })
      .select(
        "firstName lastName email role gender phone schoolId bio profileImage githubUrl leetcodeUrl codeforcesUrl batch batchHistory"
      )
      .populate("batch", "name startDate endDate status");

    const mentors = await User.find({
      $or: [
        {
          role: "mentor",
          batch: id,
        },
        {
          batchHistory: {
            $elemMatch: {
              batch: id,
              role: "mentor",
            },
          },
        },
      ],
    })
      .select(
        "firstName lastName email role gender phone bio profileImage githubUrl leetcodeUrl codeforcesUrl batch batchHistory"
      )
      .populate("batch", "name startDate endDate status");

    const teams = await Team.find({
      batch: id,
    });

    const applicants = await Applicant.find({
      batch: id,
    });

    return res.status(200).json({
      success: true,
      batch,
      students,
      mentors,
      teams,
      applicants,
      studentCount: students.length,
      mentorCount: mentors.length,
      teamCount: teams.length,
      applicantCount: applicants.length,
    });
  } catch (error) {
    console.error("Get batch details error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching batch details.",
      error: error.message,
    });
  }
};

const updateBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, status } = req.body;
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

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Batch name cannot be empty.",
        });
      }

      batch.name = name.trim();
    }

    if (startDate !== undefined) {
      batch.startDate = startDate;
    }

    if (endDate !== undefined) {
      batch.endDate = endDate || null;
    }

    if (status !== undefined) {
      if (!["upcoming", "active", "completed"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch status.",
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
          }
        );
      }

      if (status !== "active") {
        batch.isRegistrationOpen = false;
      }

      batch.status = status;
    }

    await batch.save();

    return res.status(200).json({
      success: true,
      message: "Batch updated successfully.",
      batch,
    });
  } catch (error) {
    console.error("Update batch error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating batch.",
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
  getBatchStats,
  getBatchById,
  updateBatch,
};