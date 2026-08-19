const mongoose = require("mongoose");

const Attendance = require("../models/attendance");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

// ============================================================
// HELPERS
// ============================================================

const stripTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);

  return date;
};

const isAttended = (status) => {
  return status === "Present" || status === "Late";
};

const calculateStudentRate = (records) => {
  if (!records.length) {
    return 0;
  }

  let totalChecks = 0;
  let attendedChecks = 0;

  records.forEach((record) => {
    const checks = [record.firstCheck, record.secondCheck];

    checks.forEach((check) => {
      if (!check) {
        return;
      }

      totalChecks++;

      if (isAttended(check.status)) {
        attendedChecks++;
      }
    });
  });

  if (totalChecks === 0) {
    return 0;
  }

  return Number(((attendedChecks / totalChecks) * 100).toFixed(1));
};

// ============================================================
// MARK ATTENDANCE
// ============================================================

const markAttendance = async (req, res) => {
  try {
    const { studentId, date, sessionType, sessionName, checkType, status } =
      req.body;

    const mentorId = req.user?._id;

    console.log("=================================");
    console.log("MARK ATTENDANCE");
    console.log("BODY:", req.body);
    console.log("MENTOR:", mentorId);
    console.log("=================================");

    if (!mentorId) {
      return res.status(401).json({
        success: false,
        message: "Mentor authentication required",
      });
    }

    if (
      !studentId ||
      !date ||
      !sessionType ||
      !sessionName ||
      !checkType ||
      !status
    ) {
      return res.status(400).json({
        success: false,
        message:
          "studentId, date, sessionType, sessionName, checkType and status are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    if (!["first", "second"].includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: "checkType must be 'first' or 'second'",
      });
    }

    const validStatuses = ["Present", "Absent", "Late", "Excused"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const validSessionTypes = ["Lecture", "Experience Sharing", "Contest"];

    if (!validSessionTypes.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sessionType",
      });
    }

    const validSessionNames = [
      "Lecture 1",
      "Lecture 2",
      "Experience Sharing",
      "Contest",
    ];

    if (!validSessionNames.includes(sessionName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sessionName",
      });
    }

    if (sessionType === "Contest" && sessionName !== "Contest") {
      return res.status(400).json({
        success: false,
        message: "Contest session must use Contest as sessionName",
      });
    }

    if (
      sessionType === "Experience Sharing" &&
      sessionName !== "Experience Sharing"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Experience Sharing must use Experience Sharing as sessionName",
      });
    }

    if (
      sessionType === "Lecture" &&
      !["Lecture 1", "Lecture 2"].includes(sessionName)
    ) {
      return res.status(400).json({
        success: false,
        message: "Lecture must use Lecture 1 or Lecture 2",
      });
    }

    // ============================================================
    // FIND STUDENT
    // ============================================================

    const student = await User.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.role !== "student") {
      return res.status(403).json({
        success: false,
        message: "Attendance can only be marked for students",
      });
    }

    if (!student.batch) {
      return res.status(400).json({
        success: false,
        message: "Student is not assigned to a batch",
      });
    }

    // ============================================================
    // GENDER
    // ============================================================

    if (!req.user.gender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
      });
    }

    if (!student.gender) {
      return res.status(403).json({
        success: false,
        message: "Student gender information is required",
      });
    }

    if (student.gender !== req.user.gender) {
      return res.status(403).json({
        success: false,
        message:
          "You can only mark attendance for students in your own gender group",
      });
    }

    // ============================================================
    // FIND MENTOR TEAM
    // ============================================================

    const team = await Team.findOne({
      mentors: mentorId,
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "You are not assigned to a team",
      });
    }

    const studentBelongsToTeam = (team.students || []).some(
      (id) => String(id) === String(studentId),
    );

    if (!studentBelongsToTeam) {
      return res.status(403).json({
        success: false,
        message: "Student is not assigned to your team",
      });
    }

    if (team.gender !== student.gender) {
      return res.status(403).json({
        success: false,
        message: "Student does not belong to your team's gender",
      });
    }

    if (!team.batch) {
      return res.status(400).json({
        success: false,
        message: "Your team does not have a batch assigned.",
      });
    }

    if (String(team.batch) !== String(student.batch)) {
      return res.status(403).json({
        success: false,
        message: "Student and team belong to different batches",
      });
    }

    // ============================================================
    // VERIFY BATCH
    // ============================================================

    const batch = await Batch.findById(student.batch);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Student's batch not found",
      });
    }

    // ============================================================
    // DATE
    // ============================================================

    const attendanceDate = stripTime(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    // ============================================================
    // UPDATE USING UPSERT
    // ============================================================

    const checkField = checkType === "first" ? "firstCheck" : "secondCheck";

    const update = {
      studentId,
      batchId: student.batch,
      teamId: team._id,
      date: attendanceDate,
      sessionType,
      sessionName,
      gender: student.gender,

      [checkField]: {
        status,
        markedBy: mentorId,
        timestamp: new Date(),
      },
    };

    const record = await Attendance.findOneAndUpdate(
      {
        studentId,
        batchId: student.batch,
        date: attendanceDate,
        sessionName,
      },
      {
        $set: update,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully",
      record,
    });
  } catch (error) {
    console.error("=================================");
    console.error("MARK ATTENDANCE ERROR");
    console.error(error);
    console.error("MESSAGE:", error.message);
    console.error("CODE:", error.code);
    console.error("=================================");

    return res.status(500).json({
      success: false,
      message: "Server error while marking attendance",
      error: error.message,
      code: error.code || null,
    });
  }
};

const getMentorStudents = async (req, res) => {
  try {
    const mentorId = req.user._id;
    const mentorGender = req.user.gender;

    if (!mentorGender) {
      return res.status(403).json({
        success: false,
        message: "Mentor gender information is required",
      });
    }

    const team = await Team.findOne({
      mentors: mentorId,
    })
      .populate("batch", "name status startDate endDate")
      .populate(
        "students",
        "firstName lastName fullName schoolId gender email batch",
      );

    if (!team) {
      return res.status(200).json({
        success: true,
        teamName: null,
        teamId: null,
        batch: null,
        students: [],
      });
    }

    const students = (team.students || []).filter(
      (student) => student.gender === mentorGender,
    );

    return res.status(200).json({
      success: true,
      teamName: team.name,
      teamId: team._id,
      teamGender: team.gender,
      batch: team.batch,
      mentorGender,
      students,
    });
  } catch (error) {
    console.error("getMentorStudents error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting mentor students",
      error: error.message,
    });
  }
};

// ============================================================
// GET TEAM RECORDS FOR DATE
// ============================================================

const getTeamRecordsForDate = async (req, res) => {
  try {
    const { date, sessionType, sessionName } = req.query;

    if (!date || !sessionType) {
      return res.status(400).json({
        success: false,
        message: "date and sessionType query params are required",
      });
    }

    const validSessionTypes = ["Lecture", "Experience Sharing", "Contest"];

    if (!validSessionTypes.includes(sessionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sessionType",
      });
    }

    const validSessionNames = [
      "Lecture 1",
      "Lecture 2",
      "Experience Sharing",
      "Contest",
    ];

    if (sessionName && !validSessionNames.includes(sessionName)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sessionName",
      });
    }

    const team = await Team.findOne({
      mentors: req.user._id,
    });

    if (!team) {
      return res.status(200).json({
        success: true,
        records: [],
      });
    }

    const attendanceDate = stripTime(date);

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance date",
      });
    }

    const query = {
      teamId: team._id,
      date: attendanceDate,
      sessionType,
      gender: req.user.gender,
    };

    if (sessionName) {
      query.sessionName = sessionName;
    }

    const records = await Attendance.find(query)
      .populate(
        "studentId",
        "firstName lastName fullName schoolId gender email",
      )
      .populate("firstCheck.markedBy", "firstName lastName email")
      .populate("secondCheck.markedBy", "firstName lastName email")
      .sort({
        createdAt: 1,
      });

    return res.status(200).json({
      success: true,
      teamId: team._id,
      teamName: team.name,
      batchId: team.batch,
      gender: req.user.gender,
      records,
    });
  } catch (error) {
    console.error("getTeamRecordsForDate error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting team attendance records",
      error: error.message,
    });
  }
};

// ============================================================
// GET STUDENT ATTENDANCE
// ============================================================

const getStudentAttendance = async (req, res) => {
  try {
    const { batchId } = req.query;

    const query = {
      studentId: req.user._id,
    };

    if (batchId) {
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid batch ID",
        });
      }

      if (req.user.role !== "admin") {
        const hasBatchHistory = req.user.batchHistory?.some(
          (history) =>
            history.batch && String(history.batch) === String(batchId),
        );

        const isCurrentBatch =
          req.user.batch && String(req.user.batch) === String(batchId);

        if (!hasBatchHistory && !isCurrentBatch) {
          return res.status(403).json({
            success: false,
            message: "You do not have access to this batch's attendance",
          });
        }
      }

      query.batchId = batchId;
    } else if (req.user.batch) {
      query.batchId = req.user.batch;
    }

    const records = await Attendance.find(query)
      .sort({
        date: -1,
      })
      .populate("batchId", "name status startDate endDate")
      .populate("teamId", "name gender batch")
      .populate("firstCheck.markedBy", "firstName lastName email")
      .populate("secondCheck.markedBy", "firstName lastName email");

    const percentage = calculateStudentRate(records);

    let attendedChecks = 0;
    let absentChecks = 0;
    let lateChecks = 0;
    let excusedChecks = 0;

    records.forEach((record) => {
      [record.firstCheck, record.secondCheck].forEach((check) => {
        if (!check) {
          return;
        }

        const status = check.status;

        if (status === "Present") {
          attendedChecks++;
        }

        if (status === "Late") {
          attendedChecks++;
          lateChecks++;
        }

        if (status === "Absent") {
          absentChecks++;
        }

        if (status === "Excused") {
          excusedChecks++;
        }
      });
    });

    return res.status(200).json({
      success: true,
      records,
      percentage,
      summary: {
        totalSessions: records.length,
        totalChecks: records.length * 2,
        attendedChecks,
        absentChecks,
        lateChecks,
        excusedChecks,
      },
    });
  } catch (error) {
    console.error("getStudentAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting student attendance",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN ATTENDANCE STATS
// ============================================================

const getAdminAttendanceStats = async (req, res) => {
  try {
    const batches = await Batch.find().sort({
      createdAt: -1,
    });

    const allBatches = await Promise.all(
      batches.map(async (batch) => {
        const students = await User.find({
          batch: batch._id,
          role: "student",
        }).select("_id gender");

        const totalStudents = students.length;

        const maleStudents = students.filter(
          (student) => student.gender === "Male",
        ).length;

        const femaleStudents = students.filter(
          (student) => student.gender === "Female",
        ).length;

        const studentIds = students.map((student) => student._id);

        const records =
          studentIds.length > 0
            ? await Attendance.find({
                studentId: {
                  $in: studentIds,
                },
                batchId: batch._id,
              }).sort({
                date: 1,
              })
            : [];

        const sessionKeys = new Set();

        records.forEach((record) => {
          const date = new Date(record.date).toISOString().slice(0, 10);

          sessionKeys.add(
            `${date}_${record.sessionName || record.sessionType}`,
          );
        });

        const totalSessions = sessionKeys.size;

        const totalPossibleChecks = totalStudents * totalSessions * 2;

        const malePossibleChecks = maleStudents * totalSessions * 2;

        const femalePossibleChecks = femaleStudents * totalSessions * 2;

        let totalAttendedChecks = 0;
        let maleAttendedChecks = 0;
        let femaleAttendedChecks = 0;

        let presentChecks = 0;
        let absentChecks = 0;
        let lateChecks = 0;
        let excusedChecks = 0;

        records.forEach((record) => {
          [record.firstCheck, record.secondCheck].forEach((check) => {
            if (!check) {
              return;
            }

            const status = check.status;

            if (status === "Present") {
              totalAttendedChecks++;
              presentChecks++;

              if (record.gender === "Male") {
                maleAttendedChecks++;
              }

              if (record.gender === "Female") {
                femaleAttendedChecks++;
              }
            }

            if (status === "Late") {
              totalAttendedChecks++;
              lateChecks++;

              if (record.gender === "Male") {
                maleAttendedChecks++;
              }

              if (record.gender === "Female") {
                femaleAttendedChecks++;
              }
            }

            if (status === "Absent") {
              absentChecks++;
            }

            if (status === "Excused") {
              excusedChecks++;
            }
          });
        });

        const overallAttendanceRate =
          totalPossibleChecks > 0
            ? Number(
                ((totalAttendedChecks / totalPossibleChecks) * 100).toFixed(1),
              )
            : 0;

        const maleAttendanceRate =
          malePossibleChecks > 0
            ? Number(
                ((maleAttendedChecks / malePossibleChecks) * 100).toFixed(1),
              )
            : 0;

        const femaleAttendanceRate =
          femalePossibleChecks > 0
            ? Number(
                ((femaleAttendedChecks / femalePossibleChecks) * 100).toFixed(
                  1,
                ),
              )
            : 0;

        return {
          _id: batch._id,
          name: batch.name,
          status: batch.status,
          totalStudents,
          maleStudents,
          femaleStudents,
          totalSessions,
          totalPossibleChecks,
          totalAttendedChecks,
          overallAttendanceRate,
          maleAttendanceRate,
          femaleAttendanceRate,
          presentChecks,
          absentChecks,
          lateChecks,
          excusedChecks,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      allBatches,
    });
  } catch (error) {
    console.error("getAdminAttendanceStats error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting attendance statistics",
      error: error.message,
    });
  }
};

// ============================================================
// ADMIN BATCH REPORT
// ============================================================

const getAdminBatchReport = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid batch ID",
      });
    }

    const batch = await Batch.findById(batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const students = await User.find({
      batch: batchId,
      role: "student",
    })
      .select("_id firstName lastName fullName schoolId gender email")
      .sort({
        firstName: 1,
        lastName: 1,
      });

    const studentIds = students.map((student) => student._id);

    const records =
      studentIds.length > 0
        ? await Attendance.find({
            studentId: {
              $in: studentIds,
            },
            batchId,
          }).sort({
            date: -1,
          })
        : [];

    const sessionMap = new Map();

    records.forEach((record) => {
      const date = new Date(record.date).toISOString().slice(0, 10);

      const sessionName = record.sessionName || record.sessionType;

      const key = `${date}_${sessionName}`;

      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          date,
          sessionType: record.sessionType,
          sessionName: record.sessionName || record.sessionType,
        });
      }
    });

    const totalSessions = sessionMap.size;

    const studentReports = students.map((student) => {
      const studentRecords = records.filter(
        (record) => String(record.studentId) === String(student._id),
      );

      const percentage = calculateStudentRate(studentRecords);

      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      studentRecords.forEach((record) => {
        [record.firstCheck, record.secondCheck].forEach((check) => {
          if (!check) {
            return;
          }

          if (check.status === "Present") {
            present++;
          }

          if (check.status === "Absent") {
            absent++;
          }

          if (check.status === "Late") {
            late++;
          }

          if (check.status === "Excused") {
            excused++;
          }
        });
      });

      return {
        _id: student._id,
        firstName: student.firstName,
        lastName: student.lastName,
        fullName:
          student.fullName ||
          `${student.firstName || ""} ${student.lastName || ""}`.trim(),
        schoolId: student.schoolId,
        gender: student.gender,
        email: student.email,
        percentage,
        presentChecks: present,
        absentChecks: absent,
        lateChecks: late,
        excusedChecks: excused,
        summary: {
          totalSessions,
          totalChecks: totalSessions * 2,
          present,
          absent,
          late,
          excused,
        },
        records: studentRecords,
      };
    });

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;
    let totalExcused = 0;

    records.forEach((record) => {
      [record.firstCheck, record.secondCheck].forEach((check) => {
        if (!check) {
          return;
        }

        if (check.status === "Present") {
          totalPresent++;
        }

        if (check.status === "Absent") {
          totalAbsent++;
        }

        if (check.status === "Late") {
          totalLate++;
        }

        if (check.status === "Excused") {
          totalExcused++;
        }
      });
    });

    const totalPossibleChecks = students.length * totalSessions * 2;

    const totalAttended = totalPresent + totalLate;

    const overallAttendanceRate =
      totalPossibleChecks > 0
        ? Number(((totalAttended / totalPossibleChecks) * 100).toFixed(1))
        : 0;

    return res.status(200).json({
      success: true,

      batch: {
        _id: batch._id,
        name: batch.name,
        status: batch.status,
      },

      summary: {
        totalStudents: students.length,
        totalSessions,
        totalPossibleChecks,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        overallAttendanceRate,
      },

      students: studentReports,
    });
  } catch (error) {
    console.error("getAdminBatchReport error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while getting batch attendance report",
      error: error.message,
    });
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  markAttendance,
  getMentorStudents,
  getTeamRecordsForDate,
  getStudentAttendance,
  getAdminAttendanceStats,
  getAdminBatchReport,
};
