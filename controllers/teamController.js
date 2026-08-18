const mongoose = require("mongoose");
const Team = require("../models/team");
const User = require("../models/user");

/*
|--------------------------------------------------------------------------
| CREATE TEAM
|--------------------------------------------------------------------------
| Creates a team with:
| - exactly 2 mentors
| - one or more students
| - optional project title
|--------------------------------------------------------------------------
*/
const createTeam = async (req, res) => {
  try {
    const { name, gender, mentorIds, studentIds, projectTitle } = req.body;

    if (!name || !gender) {
      return res.status(400).json({
        success: false,
        message: "Team name and gender are required",
      });
    }

    if (!name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Team name cannot be empty",
      });
    }

    if (!["Male", "Female"].includes(gender)) {
      return res.status(400).json({
        success: false,
        message: "Gender must be either 'Male' or 'Female'",
      });
    }

    if (!Array.isArray(mentorIds)) {
      return res.status(400).json({
        success: false,
        message: "mentorIds must be an array",
      });
    }

    if (mentorIds.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "A team must have exactly 2 mentors",
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

    const uniqueMentorIds = [...new Set(mentorIds.map((id) => id.toString()))];

    if (uniqueMentorIds.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "The two mentors must be different",
      });
    }

    const mentors = await User.find({
      _id: {
        $in: mentorIds,
      },
      role: "mentor",
      status: "approved",
    });

    if (mentors.length !== 2) {
      return res.status(400).json({
        success: false,
        message:
          "Both selected mentors must exist, be approved, and have the mentor role",
      });
    }

    for (const mentor of mentors) {
      if (mentor.gender !== gender) {
        return res.status(400).json({
          success: false,
          message:
            `Mentor ${mentor.firstName} ${mentor.lastName} ` +
            `does not match the ${gender} team`,
        });
      }
    }

    if (!Array.isArray(studentIds)) {
      return res.status(400).json({
        success: false,
        message: "studentIds must be an array",
      });
    }

    if (studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one student",
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

    const uniqueStudentIds = [
      ...new Set(studentIds.map((id) => id.toString())),
    ];

    if (uniqueStudentIds.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message: "Duplicate students are not allowed",
      });
    }

    const students = await User.find({
      _id: {
        $in: studentIds,
      },
      role: "student",
      status: "approved",
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more selected students were not found or are not approved",
      });
    }

    for (const student of students) {
      if (student.gender !== gender) {
        return res.status(400).json({
          success: false,
          message:
            `Student ${student.firstName} ${student.lastName} ` +
            `does not match the ${gender} team`,
        });
      }
    }

    const team = await Team.create({
      name: name.trim(),

      gender,

      mentors: mentorIds,

      students: studentIds,

      projectTitle: projectTitle ? projectTitle.trim() : "",
    });

    await User.updateMany(
      {
        _id: {
          $in: studentIds,
        },
      },
      {
        $set: {
          assignedMentors: mentorIds,
        },
      },
    );

    await User.updateMany(
      {
        _id: {
          $in: mentorIds,
        },
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
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone");

    return res.status(201).json({
      success: true,
      message: "Team created successfully with 2 mentors",
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

/*
|--------------------------------------------------------------------------
| GET ALL TEAMS
|--------------------------------------------------------------------------
*/
const getTeams = async (req, res) => {
  try {
    const { gender } = req.query;

    const filter = {};

    if (gender) {
      filter.gender = gender;
    }

    const teams = await Team.find(filter)
      .populate("mentors", "firstName lastName email gender phone")
      .populate("students", "firstName lastName email gender phone")
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
      message: "Server error while getting teams",
      error: error.message,
    });
  }
};

/*
|--------------------------------------------------------------------------
| GET TEAM BY ID
|--------------------------------------------------------------------------
*/
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
};

/*
|--------------------------------------------------------------------------
| DELETE TEAM
|--------------------------------------------------------------------------
*/
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

    if (team.students && team.students.length > 0) {
      await User.updateMany(
        {
          _id: {
            $in: team.students,
          },
        },
        {
          $unset: {
            assignedMentors: "",
          },
        },
      );
    }

    if (team.mentors && team.mentors.length > 0) {
      await User.updateMany(
        {
          _id: {
            $in: team.mentors,
          },
        },
        {
          $pull: {
            assignedStudents: {
              $in: team.students || [],
            },
          },
        },
      );
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
