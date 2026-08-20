const mongoose = require("mongoose");

const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

// ============================================================
// HELPERS
// ============================================================

const validateTeamData = async ({
  name,
  gender,
  batch,
  mentorIds,
  studentIds,
  excludeTeamId = null,
}) => {
  if (!name || !name.trim()) {
    throw new Error("Team name is required");
  }

  if (!["Male", "Female"].includes(gender)) {
    throw new Error("Gender must be either Male or Female");
  }

  if (!batch) {
    throw new Error("Batch is required");
  }

  if (!mongoose.Types.ObjectId.isValid(batch)) {
    throw new Error("Invalid batch ID");
  }

  const selectedBatch = await Batch.findById(batch);

  if (!selectedBatch) {
    throw new Error("Selected batch not found");
  }

  // ==========================================================
  // MENTORS
  // ==========================================================

  if (!Array.isArray(mentorIds) || mentorIds.length !== 2) {
    throw new Error("A team must have exactly 2 mentors");
  }

  const uniqueMentorIds = [...new Set(mentorIds.map((id) => String(id)))];

  if (uniqueMentorIds.length !== 2) {
    throw new Error("The two mentors must be different");
  }

  for (const mentorId of mentorIds) {
    if (!mongoose.Types.ObjectId.isValid(mentorId)) {
      throw new Error(`Invalid mentor ID: ${mentorId}`);
    }
  }

  const mentors = await User.find({
    _id: { $in: mentorIds },
    role: "mentor",
    status: "approved",
  });

  if (mentors.length !== 2) {
    throw new Error(
      "Both mentors must exist, be approved, and have the mentor role",
    );
  }

  for (const mentor of mentors) {
    if (mentor.gender !== gender) {
      throw new Error(
        `Mentor ${mentor.firstName} ${mentor.lastName} does not match the ${gender} team`,
      );
    }
  }

  // ==========================================================
  // STUDENTS
  // ==========================================================

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error("Please select at least one student");
  }

  const uniqueStudentIds = [...new Set(studentIds.map((id) => String(id)))];

  if (uniqueStudentIds.length !== studentIds.length) {
    throw new Error("Duplicate students are not allowed");
  }

  for (const studentId of studentIds) {
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new Error(`Invalid student ID: ${studentId}`);
    }
  }

  const students = await User.find({
    _id: { $in: studentIds },
    role: "student",
    status: "approved",
  });

  if (students.length !== studentIds.length) {
    throw new Error("One or more students were not found or are not approved");
  }

  for (const student of students) {
    if (student.gender !== gender) {
      throw new Error(
        `Student ${student.firstName} ${student.lastName} does not match the ${gender} team`,
      );
    }

    if (!student.batch) {
      throw new Error(
        `Student ${student.firstName} ${student.lastName} has no batch assigned`,
      );
    }

    if (student.batch.toString() !== batch.toString()) {
      throw new Error(
        `Student ${student.firstName} ${student.lastName} does not belong to the selected batch`,
      );
    }
  }

  // ==========================================================
  // CHECK STUDENTS ALREADY IN ANOTHER TEAM
  // ==========================================================

  const studentTeamQuery = {
    students: { $in: studentIds },
  };

  if (excludeTeamId) {
    studentTeamQuery._id = { $ne: excludeTeamId };
  }

  const existingStudentTeam = await Team.findOne(studentTeamQuery);

  if (existingStudentTeam) {
    const duplicateStudent = students.find((student) =>
      existingStudentTeam.students.some(
        (existingId) => existingId.toString() === student._id.toString(),
      ),
    );

    throw new Error(
      duplicateStudent
        ? `${duplicateStudent.firstName} ${duplicateStudent.lastName} already belongs to team "${existingStudentTeam.name}"`
        : "One or more students already belong to another team",
    );
  }

  // ==========================================================
  // CHECK MENTORS ALREADY IN ANOTHER TEAM
  // ==========================================================

  const mentorTeamQuery = {
    mentors: { $in: mentorIds },
  };

  if (excludeTeamId) {
    mentorTeamQuery._id = { $ne: excludeTeamId };
  }

  const existingMentorTeam = await Team.findOne(mentorTeamQuery);

  if (existingMentorTeam) {
    const duplicateMentor = mentors.find((mentor) =>
      existingMentorTeam.mentors.some(
        (existingId) => existingId.toString() === mentor._id.toString(),
      ),
    );

    throw new Error(
      duplicateMentor
        ? `${duplicateMentor.firstName} ${duplicateMentor.lastName} already belongs to team "${existingMentorTeam.name}"`
        : "One or more mentors already belong to another team",
    );
  }

  return {
    selectedBatch,
    mentors,
    students,
  };
};

// ============================================================
// UPDATE USER RELATIONSHIPS
// ============================================================

const updateUserRelationships = async ({
  oldMentorIds = [],
  oldStudentIds = [],
  newMentorIds = [],
  newStudentIds = [],
}) => {
  // ----------------------------------------------------------
  // REMOVE OLD MENTORS FROM OLD STUDENTS
  // ----------------------------------------------------------

  if (oldStudentIds.length > 0) {
    await User.updateMany(
      {
        _id: { $in: oldStudentIds },
      },
      {
        $set: {
          assignedMentors: [],
        },
      },
    );
  }

  // ----------------------------------------------------------
  // REMOVE OLD STUDENTS FROM OLD MENTORS
  // ----------------------------------------------------------

  if (oldMentorIds.length > 0) {
    await User.updateMany(
      {
        _id: { $in: oldMentorIds },
      },
      {
        $pull: {
          assignedStudents: {
            $in: oldStudentIds,
          },
        },
      },
    );
  }

  // ----------------------------------------------------------
  // ASSIGN NEW MENTORS TO NEW STUDENTS
  // ----------------------------------------------------------

  if (newStudentIds.length > 0) {
    await User.updateMany(
      {
        _id: { $in: newStudentIds },
      },
      {
        $set: {
          assignedMentors: newMentorIds,
        },
      },
    );
  }

  // ----------------------------------------------------------
  // ASSIGN NEW STUDENTS TO NEW MENTORS
  // ----------------------------------------------------------

  if (newMentorIds.length > 0 && newStudentIds.length > 0) {
    await User.updateMany(
      {
        _id: { $in: newMentorIds },
      },
      {
        $addToSet: {
          assignedStudents: {
            $each: newStudentIds,
          },
        },
      },
    );
  }
};

// ============================================================
// CREATE TEAM
// ============================================================

const createTeam = async (req, res) => {
  try {
    const { name, gender, batch, mentorIds, studentIds, projectTitle } =
      req.body;

    await validateTeamData({
      name,
      gender,
      batch,
      mentorIds,
      studentIds,
    });

    const team = await Team.create({
      name: name.trim(),
      gender,
      batch,
      mentors: mentorIds,
      students: studentIds,
      projectTitle: projectTitle?.trim() || "",
    });

    // Update students
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

    // Update mentors
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

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create team",
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
      .sort({
        createdAt: -1,
      });

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
    });
  }
};

// ============================================================
// UPDATE TEAM
// ============================================================

const updateTeam = async (req, res) => {
  try {
    const { id } = req.params;

    const { name, gender, batch, mentorIds, studentIds, projectTitle } =
      req.body;

    // ----------------------------------------------------------
    // VALIDATE TEAM ID
    // ----------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID",
      });
    }

    // ----------------------------------------------------------
    // FIND EXISTING TEAM
    // ----------------------------------------------------------

    const existingTeam = await Team.findById(id);

    if (!existingTeam) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

    // ----------------------------------------------------------
    // VALIDATE NEW DATA
    // ----------------------------------------------------------

    await validateTeamData({
      name,
      gender,
      batch,
      mentorIds,
      studentIds,
      excludeTeamId: id,
    });

    // ----------------------------------------------------------
    // SAVE OLD RELATIONSHIPS
    // ----------------------------------------------------------

    const oldMentorIds = existingTeam.mentors.map((id) => id.toString());

    const oldStudentIds = existingTeam.students.map((id) => id.toString());

    // ----------------------------------------------------------
    // UPDATE TEAM
    // ----------------------------------------------------------

    existingTeam.name = name.trim();
    existingTeam.gender = gender;
    existingTeam.batch = batch;
    existingTeam.mentors = mentorIds;
    existingTeam.students = studentIds;
    existingTeam.projectTitle = projectTitle?.trim() || "";

    await existingTeam.save();

    // ----------------------------------------------------------
    // UPDATE USER RELATIONSHIPS
    // ----------------------------------------------------------

    await updateUserRelationships({
      oldMentorIds,
      oldStudentIds,
      newMentorIds: mentorIds,
      newStudentIds: studentIds,
    });

    // ----------------------------------------------------------
    // GET UPDATED TEAM
    // ----------------------------------------------------------

    const populatedTeam = await Team.findById(id)
      .populate("batch", "name status startDate endDate")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone batch");

    return res.status(200).json({
      success: true,
      message: "Team updated successfully",
      team: populatedTeam,
    });
  } catch (error) {
    console.error("Update team error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update team",
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

    // ----------------------------------------------------------
    // REMOVE MENTORS FROM STUDENTS
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // REMOVE STUDENTS FROM MENTORS
    // ----------------------------------------------------------

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

    // ----------------------------------------------------------
    // DELETE TEAM
    // ----------------------------------------------------------

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
    });
  }
};

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
};
