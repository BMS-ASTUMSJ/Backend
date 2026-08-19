const ProgressContent = require("../models/progressContent");
const StudentProgress = require("../models/studentProgress");
const User = require("../models/user");
const Batch = require("../models/batch");

// 1. CREATE / PUBLISH PROGRESS CONTENT (Linked to Batch)
const createProgressContent = async (data) => {
  const { type, week, title, link, publishedBy, batchId } = data;

  if (!["cp", "dev"].includes(type)) {
    throw new Error("Invalid progress type. Must be 'cp' or 'dev'.");
  }

  // Find target batch (either specified or active batch)
  let targetBatchId = batchId;
  if (!targetBatchId) {
    const activeBatch = await Batch.findOne({ isRegistrationOpen: true }) || await Batch.findOne({ status: "active" });
    if (activeBatch) targetBatchId = activeBatch._id;
  }

  const content = await ProgressContent.create({
    type,
    week: Number(week) || 1,
    title: title.trim(),
    link: link.trim(),
    batch: targetBatchId || null,
    publishedBy,
    isPublished: true,
  });

  return content;
};

// 2. GET PUBLISHED CONTENT (Filterable by Batch, Type, Week)
const getProgressContent = async (type, week, batchId) => {
  const filter = { isPublished: true };

  if (type && type !== "all") filter.type = type;
  if (week && week !== "all") filter.week = Number(week);
  if (batchId) filter.batch = batchId;

  return ProgressContent.find(filter)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email")
    .sort({ week: 1, createdAt: 1 });
};

// 3. GET CONTENT BY ID
const getContentById = async (contentId) => {
  const content = await ProgressContent.findById(contentId)
    .populate("batch", "name status")
    .populate("publishedBy", "firstName lastName email");

  if (!content) throw new Error("Progress content not found");
  return content;
};

// 4. GET STUDENT PROGRESS CHECKLIST (Scoped to Batch)
const getStudentProgress = async (studentId, type, week, batchId) => {
  const student = await User.findById(studentId);
  const targetBatchId = batchId || student?.batch;

  const contentFilter = { isPublished: true };
  if (type && type !== "all") contentFilter.type = type;
  if (week && week !== "all") contentFilter.week = Number(week);
  if (targetBatchId) contentFilter.batch = targetBatchId;

  const contents = await ProgressContent.find(contentFilter).sort({
    week: 1,
    createdAt: 1,
  });

  if (contents.length === 0) return [];

  const contentIds = contents.map((item) => item._id);

  const progress = await StudentProgress.find({
    student: studentId,
    content: { $in: contentIds },
  }).populate("content");

  return contents.map((content) => {
    const studentProgress = progress.find(
      (item) => item.content && item.content._id.toString() === content._id.toString()
    );

    return {
      content,
      progress: studentProgress || null,
    };
  });
};

// 5. UPDATE STUDENT PROGRESS (Submit Link, Attempts, Watched Status)
const updateStudentProgress = async (studentId, contentId, data) => {
  const content = await ProgressContent.findById(contentId);
  if (!content) throw new Error("Progress content not found");

  const progressData = {
    student: studentId,
    content: contentId,
    type: content.type,
  };

  if (content.type === "cp") {
    if (data.submissionLink !== undefined) progressData.submissionLink = data.submissionLink;
    if (data.attempts !== undefined) progressData.attempts = Math.max(0, Number(data.attempts));
    if (data.timeSpent !== undefined) progressData.timeSpent = Math.max(0, Number(data.timeSpent));
    if (data.status !== undefined) progressData.status = data.status;
    if (data.submissionLink || data.status === "done") progressData.completedAt = new Date();
  }

  if (content.type === "dev") {
    if (data.status !== undefined) progressData.status = data.status;
    if (data.watched !== undefined) progressData.watched = Boolean(data.watched);
    if (data.status === "done" || data.watched === true) progressData.completedAt = new Date();
  }

  return StudentProgress.findOneAndUpdate(
    { student: studentId, content: contentId },
    { $set: progressData },
    { new: true, upsert: true, runValidators: true }
  ).populate("content");
};

// Helper: Check completion
const isProgressCompleted = (progress, type) => {
  if (!progress) return false;
  if (type === "cp") {
    return Boolean(progress.submissionLink || progress.status === "done" || progress.completedAt);
  }
  if (type === "dev") {
    return progress.status === "done" || progress.watched === true || Boolean(progress.completedAt);
  }
  return false;
};

// 6. GET STUDENT SUMMARY STATS
const getStudentSummary = async (studentId, type, week, batchId) => {
  const contentFilter = { isPublished: true };
  if (type && type !== "all") contentFilter.type = type;
  if (week && week !== "all") contentFilter.week = Number(week);
  if (batchId) contentFilter.batch = batchId;

  const contents = await ProgressContent.find(contentFilter);
  if (contents.length === 0) return { total: 0, completed: 0, completion: 0 };

  const contentIds = contents.map((item) => item._id);

  const progress = await StudentProgress.find({
    student: studentId,
    content: { $in: contentIds },
  });

  const completed = contents.reduce((count, content) => {
    const studentProgress = progress.find(
      (item) => item.content.toString() === content._id.toString()
    );
    return count + (isProgressCompleted(studentProgress, content.type) ? 1 : 0);
  }, 0);

  const total = contents.length;
  const completion = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { total, completed, completion };
};

// 7. GET STUDENT RANK (Within their cohort batch)
const getStudentRank = async (studentId, type, week, batchId) => {
  const targetStudent = await User.findById(studentId);
  const targetBatch = batchId || targetStudent?.batch;

  const studentFilter = { role: "student" };
  if (targetBatch) studentFilter.batch = targetBatch;

  const students = await User.find(studentFilter).select("_id gender");
  const rankings = [];

  for (const s of students) {
    const summary = await getStudentSummary(s._id, type, week, targetBatch);
    rankings.push({
      studentId: s._id.toString(),
      gender: s.gender,
      completed: summary.completed,
      total: summary.total,
      completion: summary.completion,
    });
  }

  rankings.sort((a, b) => {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.completion !== a.completion) return b.completion - a.completion;
    return a.studentId.localeCompare(b.studentId);
  });

  const rank = rankings.findIndex((item) => item.studentId === studentId.toString()) + 1;

  return {
    rank: rank || null,
    totalStudents: rankings.length,
  };
};

// 8. GET OVERALL PROGRESS (Leaderboard for Admin)
const getOverallProgress = async (type, week, batchId) => {
  const studentFilter = { role: "student" };
  if (batchId) studentFilter.batch = batchId;

  const students = await User.find(studentFilter).select("firstName lastName email gender batch");
  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(student._id, type, week, batchId || student.batch);
    const rank = await getStudentRank(student._id, type, week, batchId || student.batch);

    results.push({
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        gender: student.gender,
      },
      total: summary.total,
      completed: summary.completed,
      completion: summary.completion,
      rank: rank.rank,
    });
  }

  return results.sort((a, b) => {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.completion !== a.completion) return b.completion - a.completion;
    return a.student.name.localeCompare(b.student.name);
  });
};

// 9. GET GENDER PROGRESS (Admin Female vs Male Leaderboards)
const getGenderProgress = async (gender, type, week, batchId) => {
  if (!["Male", "Female"].includes(gender)) throw new Error("Invalid gender");

  const studentFilter = { role: "student", gender };
  if (batchId) studentFilter.batch = batchId;

  const students = await User.find(studentFilter).select("firstName lastName email gender batch");
  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(student._id, type, week, batchId || student.batch);
    const rank = await getStudentRank(student._id, type, week, batchId || student.batch);

    results.push({
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        gender: student.gender,
      },
      total: summary.total,
      completed: summary.completed,
      completion: summary.completion,
      rank: rank.rank,
    });
  }

  return results.sort((a, b) => {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.completion !== a.completion) return b.completion - a.completion;
    return a.student.name.localeCompare(b.student.name);
  });
};

// 10. GET MENTOR PROGRESS (Mentor sees ONLY assigned students of matching gender)
const getMentorProgress = async (mentorId, type, week, batchId) => {
  const mentor = await User.findOne({ _id: mentorId, role: "mentor" }).select(
    "firstName lastName email gender assignedStudents batch"
  );

  if (!mentor) throw new Error("Mentor not found");

  const studentFilter = {
    _id: { $in: mentor.assignedStudents || [] },
    role: "student",
    gender: mentor.gender,
  };
  if (batchId) studentFilter.batch = batchId;

  const students = await User.find(studentFilter).select("firstName lastName email gender");
  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(student._id, type, week, batchId || mentor.batch);
    const rank = await getStudentRank(student._id, type, week, batchId || mentor.batch);

    results.push({
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        gender: student.gender,
      },
      total: summary.total,
      completed: summary.completed,
      completion: summary.completion,
      rank: rank.rank,
    });
  }

  return results.sort((a, b) => {
    if (b.completed !== a.completed) return b.completed - a.completed;
    if (b.completion !== a.completion) return b.completion - a.completion;
    return a.student.name.localeCompare(b.student.name);
  });
};

// 11. GET STUDENT DASHBOARD (With Past Batches and Ranks)
const getProgressDashboard = async (studentId, batchId) => {
  const student = await User.findOne({ _id: studentId }).populate("pastBatches", "name status");
  if (!student) throw new Error("Student not found");

  const targetBatch = batchId || student.batch;

  const cpSummary = await getStudentSummary(studentId, "cp", null, targetBatch);
  const devSummary = await getStudentSummary(studentId, "dev", null, targetBatch);
  const cpRank = await getStudentRank(studentId, "cp", null, targetBatch);
  const devRank = await getStudentRank(studentId, "dev", null, targetBatch);

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      gender: student.gender,
      currentBatch: student.batch,
      pastBatches: student.pastBatches || [],
    },
    cp: {
      total: cpSummary.total,
      completed: cpSummary.completed,
      completion: cpSummary.completion,
      rank: cpRank.rank,
      totalStudents: cpRank.totalStudents,
    },
    dev: {
      total: devSummary.total,
      completed: devSummary.completed,
      completion: devSummary.completion,
      rank: devRank.rank,
      totalStudents: devRank.totalStudents,
    },
  };
};

// 12. GET WEEKLY PROGRESS
const getWeeklyProgress = async (week, batchId) => {
  const studentFilter = { role: "student" };
  if (batchId) studentFilter.batch = batchId;

  const students = await User.find(studentFilter).select("firstName lastName email gender batch");
  const results = [];

  for (const student of students) {
    const cp = await getStudentSummary(student._id, "cp", week, batchId || student.batch);
    const dev = await getStudentSummary(student._id, "dev", week, batchId || student.batch);

    results.push({
      student: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        gender: student.gender,
      },
      cp,
      dev,
    });
  }

  return results;
};

// 13. UNPUBLISH CONTENT
const unpublishProgressContent = async (contentId) => {
  const content = await ProgressContent.findByIdAndUpdate(
    contentId,
    { isPublished: false },
    { new: true }
  );

  if (!content) throw new Error("Progress content not found");
  return content;
};

module.exports = {
  createProgressContent,
  getProgressContent,
  getContentById,
  getStudentProgress,
  updateStudentProgress,
  getStudentSummary,
  getStudentRank,
  getOverallProgress,
  getGenderProgress,
  getMentorProgress,
  getProgressDashboard,
  getWeeklyProgress,
  unpublishProgressContent,
};