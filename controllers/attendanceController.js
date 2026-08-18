const Attendance = require("../models/attendance");
const Team = require("../models/team");
const User = require("../models/user");
const Batch = require("../models/batch");

const stripTime = (d) => {
  const date = new Date(d);

  date.setHours(0, 0, 0, 0);

  return date;
};

const isAttended = (status) => {
  return status === "Present" || status === "Late";
};

const calculateStudentRate = (records) => {
  let totalChecks = records.length * 2;

  let attendedChecks = 0;

  records.forEach((record) => {
    if (isAttended(record.firstCheck?.status)) {
      attendedChecks++;
    }

    if (isAttended(record.secondCheck?.status)) {
      attendedChecks++;
    }
  });

  if (totalChecks === 0) {
    return 0;
  }

  return Number(((attendedChecks / totalChecks) * 100).toFixed(1));
};

const markAttendance = async (req, res) => {
  try {
    const { studentId, date, sessionType, checkType, status } = req.body;

    const mentorId = req.user._id;

    if (!studentId || !date || !sessionType || !checkType || !status) {
      return res.status(400).json({
        success: false,
        message:
          "studentId, date, sessionType, checkType and status are required",
      });
    }

    if (!["first", "second"].includes(checkType)) {
      return res.status(400).json({
        success: false,
        message: "checkType must be 'first' or 'second'",
      });
    }

    if (!["Present", "Absent", "Late", "Excused"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status",
      });
    }

    const student = await User.findById(studentId);

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    if (student.gender !== req.user.gender) {
      return res.status(403).json({
        success: false,
        message:
          "You can only mark attendance for students in your own gender group",
      });
    }

    const team = await Team.findOne({
      students: studentId,
    });

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Student not assigned to a team",
      });
    }

    const isAssignedMentor = team.mentors.some(
      (mentor) => mentor.toString() === mentorId.toString(),
    );

    if (!isAssignedMentor) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this student's team",
      });
    }

    const attendanceDate = stripTime(date);

    let record = await Attendance.findOne({
      studentId,
      date: attendanceDate,
      sessionType,
    });

    if (!record) {
      record = new Attendance({
        studentId,
        teamId: team._id,
        date: attendanceDate,
        sessionType,
        gender: student.gender,
      });
    }

    const checkPayload = {
      status,
      markedBy: mentorId,
      timestamp: new Date(),
    };

    if (checkType === "first") {
      record.firstCheck = checkPayload;
    } else {
      record.secondCheck = checkPayload;
    }

    await record.save();

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully",
      record,
    });
  } catch (error) {
    console.error("markAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getMentorStudents = async (req, res) => {
  try {
    const team = await Team.findOne({
      mentors: req.user._id,
    }).populate("students", "firstName lastName schoolId gender email");

    if (!team) {
      return res.status(200).json({
        success: true,
        teamName: null,
        students: [],
      });
    }

    return res.status(200).json({
      success: true,
      teamName: team.name,
      teamId: team._id,
      students: team.students,
    });
  } catch (error) {
    console.error("getMentorStudents error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getTeamRecordsForDate = async (req, res) => {
  try {
    const { date, sessionType } = req.query;

    if (!date || !sessionType) {
      return res.status(400).json({
        success: false,
        message: "date and sessionType query params are required",
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

    const records = await Attendance.find({
      teamId: team._id,
      date: attendanceDate,
      sessionType,
    });

    return res.status(200).json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("getTeamRecordsForDate error:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getStudentAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      studentId: req.user._id,
    }).sort({
      date: -1,
    });

    const percentage = calculateStudentRate(records);

    let attendedChecks = 0;
    let absentChecks = 0;
    let lateChecks = 0;
    let excusedChecks = 0;

    records.forEach((record) => {
      const checks = [record.firstCheck, record.secondCheck];

      checks.forEach((check) => {
        const status = check?.status || "Absent";

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
      message: error.message,
    });
  }
};

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
              }).sort({
                date: 1,
              })
            : [];

        const sessionKeys = new Set();

        records.forEach((record) => {
          const date = new Date(record.date).toISOString().slice(0, 10);

          sessionKeys.add(`${date}_${record.sessionType}`);
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
          const checks = [record.firstCheck, record.secondCheck];

          checks.forEach((check) => {
            const status = check?.status || "Absent";

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
      message: error.message,
    });
  }
};

const getAdminBatchReport = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: "Batch ID is required",
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
          }).sort({
            date: -1,
          })
        : [];

    const sessionMap = new Map();

    records.forEach((record) => {
      const date = new Date(record.date).toISOString().slice(0, 10);

      const key = `${date}_${record.sessionType}`;

      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          date,
          sessionType: record.sessionType,
        });
      }
    });

    const totalSessions = sessionMap.size;

    const studentReports = students.map((student) => {
      const studentRecords = records.filter(
        (record) => record.studentId.toString() === student._id.toString(),
      );

      const percentage = calculateStudentRate(studentRecords);

      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;

      studentRecords.forEach((record) => {
        const checks = [record.firstCheck, record.secondCheck];

        checks.forEach((check) => {
          const status = check?.status || "Absent";

          if (status === "Present") {
            present++;
          }

          if (status === "Absent") {
            absent++;
          }

          if (status === "Late") {
            late++;
          }

          if (status === "Excused") {
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
        const status = check?.status || "Absent";

        if (status === "Present") {
          totalPresent++;
        }

        if (status === "Absent") {
          totalAbsent++;
        }

        if (status === "Late") {
          totalLate++;
        }

        if (status === "Excused") {
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
      message: error.message,
    });
  }
};

module.exports = {
  markAttendance,
  getMentorStudents,
  getTeamRecordsForDate,
  getStudentAttendance,
  getAdminAttendanceStats,
  getAdminBatchReport,
};
