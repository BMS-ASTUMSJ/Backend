const mongoose = require("mongoose");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");


const createTeam = async (req, res) => {
  try {
    const { name, batchId, gender, mentorIds, studentIds, projectTitle } = req.body;

    if (!name || !batchId || !gender) {
      return res.status(400).json({
        success: false,
        message: "Team name, batchId, and gender (Male/Female) are required",
      });
    }

    if (!["Male", "Female"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender must be either 'Male' or 'Female'",
      });
    }

    
    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Batch ID",
      });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    
    const selectedMentors = mentorIds || [];
    if (!Array.isArray(selectedMentors) || selectedMentors.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please assign at least 1 or 2 mentors to this team",
      });
    }

    if (selectedMentors.length > 2) {
      return res.status(400).json({
        success: false,
        message: "A team can have a maximum of 2 mentors",
      });
    }

    const mentors = await User.find({
      _id: { $in: selectedMentors },
      role: "mentor",
      status: "approved",
    });

    if (mentors.length !== selectedMentors.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected mentors were not found or are suspended",
      });
    }

    
    for (const m of mentors) {
      const mentorGender = m.gender || "Female";
      if (mentorGender !== gender) {
        return res.status(400).json({
          success: false,
          message: `Mentor gender mismatch: Team is ${gender}, but mentor ${m.firstName} ${m.lastName} is ${mentorGender}.`,
        });
      }
    }

    
    const selectedStudents = studentIds || [];
    if (!Array.isArray(selectedStudents) || selectedStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please add students to this team (typically 5 to 7 students)",
      });
    }

    const students = await User.find({
      _id: { $in: selectedStudents },
      role: "student",
      status: "approved",
    });

    if (students.length !== selectedStudents.length) {
      return res.status(400).json({
        success: false,
        message: "One or more selected students were not found or are suspended",
      });
    }

    
    for (const s of students) {
      const studentGender = s.gender || "Female";
      if (studentGender !== gender) {
        return res.status(400).json({
          success: false,
          message: `Student gender mismatch: Team is ${gender}, but student ${s.firstName} ${s.lastName} is ${studentGender}.`,
        });
      }
    }

    const team = await Team.create({
      name: name.trim(),
      batch: batchId,
      gender,
      mentors: selectedMentors,
      students: selectedStudents,
      projectTitle: projectTitle ? projectTitle.trim() : "",
    });

    // Automatically link Mentors to all Students in this Team
    await User.updateMany(
      { _id: { $in: selectedStudents } },
      { assignedMentors: selectedMentors, batch: batchId }
    );

    
    await User.updateMany(
      { _id: { $in: selectedMentors } },
      { $addToSet: { assignedStudents: { $each: selectedStudents } } }
    );

    const populatedTeam = await Team.findById(team._id)
      .populate("batch", "name")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone");

    return res.status(201).json({
      success: true,
      message: "Team created and mentors assigned successfully",
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


const getTeams = async (req, res) => {
  try {
    const { gender, batchId } = req.query;

    const filter = {};
    if (gender) filter.gender = gender;
    if (batchId && mongoose.Types.ObjectId.isValid(batchId)) filter.batch = batchId;

    const teams = await Team.find(filter)
      .populate("batch", "name")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone")
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
      message: "Server error while getting teams",
      error: error.message,
    });
  }
};

const getTeamById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Team ID",
      });
    }

    const team = await Team.findById(id)
      .populate("batch", "name")
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone");

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
    console.error("Get team by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while getting team",
      error: error.message,
    });
  }
}
const deleteTeam = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Team ID",
      });
    }

    const team = await Team.findById(id);
    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found",
      });
    }

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

module.exports = {
  createTeam,
  getTeams,
  getTeamById,
  deleteTeam,
};