const mongoose = require("mongoose");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

// ============================================================
// CREATE TEAM
// ============================================================

const createTeam = async (req, res) => {
  try {
    const { name, gender, batch, mentorIds, studentIds, projectTitle } =
      req.body;

    // ============================================================
    // BASIC VALIDATION
    // ============================================================

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Team name is required",
      });
    }

    if (!["Male", "Female"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender must be either Male or Female",
      });
    }

    if (!batch) {
      return res.status(400).json({
        success: false,
        message: "Batch is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batch)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const selectedBatch = await Batch.findById(batch);

    if (!selectedBatch) {
      return res.status(404).json({
        success: false,
        message: "Selected batch not found",
      });
    }

    // ============================================================
    // MENTORS
    // ============================================================

    if (!Array.isArray(mentorIds) || mentorIds.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "A team must have exactly 2 mentors",
      });
    }

    const uniqueMentorIds = [...new Set(mentorIds.map((id) => String(id)))];

    if (uniqueMentorIds.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "The two mentors must be different",
      });
    }

    for (const mentorId of mentorIds) {
      if (!mongoose.Types.ObjectId.isValid(mentorId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid mentor ID: ${mentorId}`,
        });
      }
    }

    const mentors = await User.find({
      _id: { $in: mentorIds },
      role: "mentor",
      status: "approved",
    });

    if (mentors.length !== 2) {
      return res.status(400).json({
        success: false,
        message:
          "Both mentors must exist, be approved, and have the mentor role",
      });
    }

    for (const mentor of mentors) {
      if (mentor.gender !== gender) {
        return res.status(400).json({
          success: false,
          message: `Mentor ${mentor.firstName} ${mentor.lastName} does not match the ${gender} team`,
        });
      }
    }

    // ============================================================
    // STUDENTS
    // ============================================================

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one student",
      });
    }

    const uniqueStudentIds = [...new Set(studentIds.map((id) => String(id)))];

    if (uniqueStudentIds.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate students are not allowed",
      });
    }

    for (const studentId of studentIds) {
      if (!mongoose.Types.ObjectId.isValid(studentId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid student ID: ${studentId}`,
        });
      }
    }

    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
      status: "approved",
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more students were not found or are not approved",
      });
    }

    // ============================================================
    // CHECK STUDENTS
    // ============================================================

    for (const student of students) {
      if (student.gender !== gender) {
        return res.status(400).json({
          success: false,
          message: `Student ${student.firstName} ${student.lastName} does not match the ${gender} team`,
        });
      }

      if (!student.batch) {
        return res.status(400).json({
          success: false,
          message: `Student ${student.firstName} ${student.lastName} has no batch assigned`,
        });
      }

      if (student.batch.toString() !== batch.toString()) {
        return res.status(400).json({
          success: false,
          message: `Student ${student.firstName} ${student.lastName} does not belong to the selected batch`,
        });
      }
    }

    // ============================================================
    // CHECK EXISTING STUDENT TEAM
    // ============================================================

    const existingStudentTeam = await Team.findOne({
      students: { $in: studentIds },
    });

    if (existingStudentTeam) {
      const duplicateStudent = students.find((student) =>
        existingStudentTeam.students.some(
          (existingId) => existingId.toString() === student._id.toString(),
        ),
      );

      return res.status(400).json({
        success: false,
        message: duplicateStudent
          ? `${duplicateStudent.firstName} ${duplicateStudent.lastName} already belongs to team "${existingStudentTeam.name}"`
          : "One or more students already belong to another team",
      });
    }

    // ============================================================
    // CHECK EXISTING MENTOR TEAM
    // ============================================================

    const existingMentorTeam = await Team.findOne({
      mentors: { $in: mentorIds },
    });

    if (existingMentorTeam) {
      const duplicateMentor = mentors.find((mentor) =>
        existingMentorTeam.mentors.some(
          (existingId) => existingId.toString() === mentor._id.toString(),
        ),
      );

      return res.status(400).json({
        success: false,
        message: duplicateMentor
          ? `${duplicateMentor.firstName} ${duplicateMentor.lastName} already belongs to team "${existingMentorTeam.name}"`
          : "One or more mentors already belong to another team",
      });
    }

    // ============================================================
    // CREATE TEAM
    // ============================================================

    const team = await Team.create({
      name: name.trim(),
      gender,
      batch,
      mentors: mentorIds,
      students: studentIds,
      projectTitle: projectTitle?.trim() || "",
    });

    // ============================================================
    // UPDATE STUDENTS
    // ============================================================

    await User.updateMany(
      {
        _id: { $in: studentIds },
      },
      {
        $set: {
          assignedMentors: mentorIds,
        },
      },
    );

    // ============================================================
    // UPDATE MENTORS
    // ============================================================

    await User.updateMany(
      {
        _id: { $in: mentorIds },
      },
      {
        $addToSet: {
          assignedStudents: {
            $each: studentIds,
          },
        },
      },
    );

    // ============================================================
    // POPULATE CREATED TEAM
    // ============================================================

    const populatedTeam = await Team.findById(team._id)
      .populate("batch", "name status startDate endDate")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone batch");

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      team: populatedTeam,
    });
  } catch (error) {
    console.error("Create team error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating team",
      error: error.message,
    });
  }
};

// ============================================================
// GET ALL TEAMS
// ============================================================

const getTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .populate("batch", "name status startDate endDate")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone batch")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (error) {
    console.error("Get teams error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching teams",
      error: error.message,
    });
  }
};

// ============================================================
// GET TEAM BY ID
// ============================================================

const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id)
      .populate("batch", "name status startDate endDate")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone batch");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    return res.status(200).json({
      success: true,
      team,
    });
  } catch (error) {
    console.error("Get team by ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching team",
      error: error.message,
    });
  }
};

// ============================================================
// DELETE TEAM
// ============================================================

const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    const team = await Team.findById(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // ============================================================
    // REMOVE MENTORS FROM STUDENTS
    // ============================================================

    if (Array.isArray(team.students) && team.students.length > 0) {
      await User.updateMany(
        {
          _id: { $in: team.students },
        },
        {
          $set: {
            assignedMentors: [],
          },
        },
      );
    }

    // ============================================================
    // REMOVE STUDENTS FROM MENTORS
    // ============================================================

    if (Array.isArray(team.mentors) && team.mentors.length > 0) {
      await User.updateMany(
        {
          _id: { $in: team.mentors },
        },
        {
          $pull: {
            assignedStudents: {
              $in: team.students,
            },
          },
        },
      );
    }

    // ============================================================
    // DELETE TEAM
    // ============================================================

    await Team.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Delete team error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting team",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  deleteTeam,
};
