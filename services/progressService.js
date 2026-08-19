const ProgressContent = require("../models/progressContent");
const StudentProgress = require("../models/studentProgress");
const User = require("../models/user");
const Batch = require("../models/batch");

// ============================================================
// HELPERS
// ============================================================

const getStudentBatchIds = async (studentId) => {
  const student = await User.findById(studentId).select("batch batchHistory");

  if (!student) {
    throw new Error("Student not found");
  }

  const batchIds = [];

  if (student.batch) {
    batchIds.push(student.batch.toString());
  }

  if (Array.isArray(student.batchHistory)) {
    student.batchHistory.forEach((history) => {
      if (history.batch) {
        const id = history.batch.toString();

        if (!batchIds.includes(id)) {
          batchIds.push(id);
        }
      }
    });
  }

  return batchIds;
};

const getStudentCurrentBatch = async (studentId) => {
  const student = await User.findById(studentId).select("batch role");

  if (!student) {
    throw new Error("User not found");
  }

  if (!student.batch) {
    throw new Error("No batch assigned to this user");
  }

  return student.batch;
};

// ============================================================
// 1. CREATE / PUBLISH PROGRESS CONTENT
// ============================================================

const createProgressContent = async (data) => {
  const { batch, batchId, type, week, title, link, publishedBy } = data;

  if (!["cp", "dev"].includes(type)) {
    throw new Error("Invalid progress type. Must be 'cp' or 'dev'.");
  }

  if (!title || !title.trim()) {
    throw new Error("Title is required");
  }

  if (!link || !link.trim()) {
    throw new Error("Link is required");
  }

  const weekNumber = Number(week);

  if (!Number.isInteger(weekNumber) || weekNumber < 1) {
    throw new Error("Week must be a valid number");
  }

  // Support both "batch" and "batchId"
  let targetBatchId = batch || batchId;

  // If no batch was supplied, use the active batch
  if (!targetBatchId) {
    const activeBatch =
      (await Batch.findOne({ isRegistrationOpen: true })) ||
      (await Batch.findOne({ status: "active" }));

    if (activeBatch) {
      targetBatchId = activeBatch._id;
    }
  }

  if (!targetBatchId) {
    throw new Error("Batch is required");
  }

  const batchExists = await Batch.findById(targetBatchId);

  if (!batchExists) {
    throw new Error("Batch not found");
  }

  if (!publishedBy) {
    throw new Error("Publisher is required");
  }

  return ProgressContent.create({
    batch: targetBatchId,
    type,
    week: weekNumber,
    title: title.trim(),
    link: link.trim(),
    publishedBy,
    isPublished: true,
  });
};

// ============================================================
// 2. GET PUBLISHED CONTENT
// ============================================================

const getProgressContent = async (type, week, batchId) => {
  const filter = {
    isPublished: true,
  };

  if (batchId) {
    filter.batch = batchId;
  }

  if (type && type !== "all") {
    filter.type = type;
  }

  if (week && week !== "all") {
    filter.week = Number(week);
  }

  return ProgressContent.find(filter)
    .populate("publishedBy", "firstName lastName email")
    .populate("batch", "name status startDate endDate")
    .sort({
      week: 1,
      createdAt: 1,
    });
};

// ============================================================
// 3. GET CONTENT BY ID
// ============================================================

const getContentById = async (contentId) => {
  const content = await ProgressContent.findById(contentId)
    .populate("publishedBy", "firstName lastName email")
    .populate("batch", "name status startDate endDate");

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

// ============================================================
// 4. GET STUDENT PROGRESS
// ============================================================

const getStudentProgress = async (studentId, type, week, batchId) => {
  const allowedBatches = await getStudentBatchIds(studentId);

  if (batchId && !allowedBatches.includes(batchId.toString())) {
    throw new Error("You do not have access to this batch");
  }

  const selectedBatch = batchId ? batchId.toString() : allowedBatches[0];

  if (!selectedBatch) {
    return [];
  }

  const contentFilter = {
    isPublished: true,
    batch: selectedBatch,
  };

  if (type && type !== "all") {
    contentFilter.type = type;
  }

  if (week && week !== "all") {
    contentFilter.week = Number(week);
  }

  const contents = await ProgressContent.find(contentFilter)
    .populate("batch", "name status")
    .sort({
      week: 1,
      createdAt: 1,
    });

  if (contents.length === 0) {
    return [];
  }

  const contentIds = contents.map((item) => item._id);

  const progress = await StudentProgress.find({
    student: studentId,
    batch: selectedBatch,
    content: { $in: contentIds },
  }).populate("content");

  return contents.map((content) => {
    const studentProgress = progress.find(
      (item) =>
        item.content && item.content._id.toString() === content._id.toString(),
    );

    return {
      content,
      progress: studentProgress || null,
    };
  });
};

// ============================================================
// 5. UPDATE STUDENT PROGRESS
// ============================================================

const updateStudentProgress = async (studentId, contentId, data) => {
  const content = await ProgressContent.findById(contentId);

  if (!content) {
    throw new Error("Progress content not found");
  }

  const allowedBatches = await getStudentBatchIds(studentId);

  if (content.batch && !allowedBatches.includes(content.batch.toString())) {
    throw new Error("You do not have access to this batch");
  }

  const progressData = {
    student: studentId,
    batch: content.batch,
    content: contentId,
    type: content.type,
  };

  if (content.type === "cp") {
    if (data.submissionLink !== undefined) {
      progressData.submissionLink = String(data.submissionLink);
    }

    if (data.attempts !== undefined) {
      progressData.attempts = Math.max(0, Number(data.attempts) || 0);
    }

    if (data.timeSpent !== undefined) {
      progressData.timeSpent = Math.max(0, Number(data.timeSpent) || 0);
    }

    if (data.status !== undefined) {
      progressData.status = data.status;
    }

    if (data.submissionLink || data.status === "done") {
      progressData.completedAt = new Date();
    }
  }

  if (content.type === "dev") {
    if (data.status !== undefined) {
      progressData.status = data.status;
    }

    if (data.watched !== undefined) {
      progressData.watched = Boolean(data.watched);
    }

    if (data.status === "done" || data.watched === true) {
      progressData.completedAt = new Date();
    }
  }

  return StudentProgress.findOneAndUpdate(
    {
      student: studentId,
      batch: content.batch,
      content: contentId,
    },
    {
      $set: progressData,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  ).populate("content");
};

// ============================================================
// 6. CHECK COMPLETION
// ============================================================

const isProgressCompleted = (progress, type) => {
  if (!progress) {
    return false;
  }

  if (type === "cp") {
    return Boolean(
      progress.submissionLink ||
      progress.status === "done" ||
      progress.completedAt,
    );
  }

  if (type === "dev") {
    return Boolean(
      progress.status === "done" ||
      progress.watched === true ||
      progress.completedAt,
    );
  }

  return false;
};

// ============================================================
// 7. GET STUDENT SUMMARY
// ============================================================

const getStudentSummary = async (studentId, type, week, batchId) => {
  const allowedBatches = await getStudentBatchIds(studentId);

  if (batchId && !allowedBatches.includes(batchId.toString())) {
    throw new Error("You do not have access to this batch");
  }

  const selectedBatch = batchId ? batchId.toString() : allowedBatches[0];

  if (!selectedBatch) {
    return {
      total: 0,
      completed: 0,
      completion: 0,
    };
  }

  const contentFilter = {
    isPublished: true,
    batch: selectedBatch,
  };

  if (type && type !== "all") {
    contentFilter.type = type;
  }

  if (week && week !== "all") {
    contentFilter.week = Number(week);
  }

  const contents = await ProgressContent.find(contentFilter);

  if (contents.length === 0) {
    return {
      total: 0,
      completed: 0,
      completion: 0,
    };
  }

  const contentIds = contents.map((item) => item._id);

  const progress = await StudentProgress.find({
    student: studentId,
    batch: selectedBatch,
    content: { $in: contentIds },
  });

  const completed = contents.reduce((count, content) => {
    const studentProgress = progress.find(
      (item) => item.content.toString() === content._id.toString(),
    );

    return count + (isProgressCompleted(studentProgress, content.type) ? 1 : 0);
  }, 0);

  const total = contents.length;

  const completion = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    completion,
  };
};

// ============================================================
// 8. GET STUDENT RANK
// ============================================================

const getStudentRank = async (studentId, type, week, batchId) => {
  const selectedBatch = batchId || (await getStudentCurrentBatch(studentId));

  const students = await User.find({
    role: "student",
    $or: [
      { batch: selectedBatch },
      {
        batchHistory: {
          $elemMatch: {
            batch: selectedBatch,
            role: "student",
          },
        },
      },
    ],
  }).select("_id gender");

  const rankings = [];

  for (const student of students) {
    const summary = await getStudentSummary(
      student._id,
      type,
      week,
      selectedBatch,
    );

    rankings.push({
      studentId: student._id.toString(),
      gender: student.gender,
      completed: summary.completed,
      total: summary.total,
      completion: summary.completion,
    });
  }

  rankings.sort((a, b) => {
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }

    if (b.completion !== a.completion) {
      return b.completion - a.completion;
    }

    return a.studentId.localeCompare(b.studentId);
  });

  const rank =
    rankings.findIndex((item) => item.studentId === studentId.toString()) + 1;

  return {
    rank: rank || null,
    totalStudents: rankings.length,
  };
};

// ============================================================
// 9. GET OVERALL PROGRESS
// ============================================================

const getOverallProgress = async (type, week, batchId) => {
  if (!batchId) {
    throw new Error("Batch ID is required");
  }

  const students = await User.find({
    role: "student",
    batch: batchId,
  }).select("firstName lastName email gender batch");

  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(student._id, type, week, batchId);

    const rank = await getStudentRank(student._id, type, week, batchId);

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
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }

    if (b.completion !== a.completion) {
      return b.completion - a.completion;
    }

    return a.student.name.localeCompare(b.student.name);
  });
};

// ============================================================
// 10. GET GENDER PROGRESS
// ============================================================

const getGenderProgress = async (gender, type, week, batchId) => {
  if (!["Male", "Female"].includes(gender)) {
    throw new Error("Invalid gender");
  }

  if (!batchId) {
    throw new Error("Batch ID is required");
  }

  const students = await User.find({
    role: "student",
    gender,
    batch: batchId,
  }).select("firstName lastName email gender batch");

  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(student._id, type, week, batchId);

    const rank = await getStudentRank(student._id, type, week, batchId);

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
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }

    if (b.completion !== a.completion) {
      return b.completion - a.completion;
    }

    return a.student.name.localeCompare(b.student.name);
  });
};

// ============================================================
// 11. GET MENTOR PROGRESS
// ============================================================

const getMentorProgress = async (mentorId, type, week, batchId) => {
  const mentor = await User.findOne({
    _id: mentorId,
    role: "mentor",
  }).select("firstName lastName email gender assignedStudents batch");

  if (!mentor) {
    throw new Error("Mentor not found");
  }

  const selectedBatch = batchId || mentor.batch;

  if (!selectedBatch) {
    return [];
  }

  if (mentor.batch && mentor.batch.toString() !== selectedBatch.toString()) {
    throw new Error("You do not have access to this mentor batch");
  }

  const students = await User.find({
    _id: {
      $in: mentor.assignedStudents || [],
    },
    role: "student",
    batch: selectedBatch,
    gender: mentor.gender,
  }).select("firstName lastName email gender");

  const results = [];

  for (const student of students) {
    const summary = await getStudentSummary(
      student._id,
      type,
      week,
      selectedBatch,
    );

    const rank = await getStudentRank(student._id, type, week, selectedBatch);

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
    if (b.completed !== a.completed) {
      return b.completed - a.completed;
    }

    if (b.completion !== a.completion) {
      return b.completion - a.completion;
    }

    return a.student.name.localeCompare(b.student.name);
  });
};

// ============================================================
// 12. GET STUDENT DASHBOARD
// ============================================================

const getProgressDashboard = async (studentId, batchId) => {
  const student = await User.findById(studentId).select(
    "firstName lastName email gender batch batchHistory",
  );

  if (!student) {
    throw new Error("Student not found");
  }

  const allowedBatches = await getStudentBatchIds(studentId);

  const selectedBatch = batchId || student.batch;

  if (!selectedBatch) {
    throw new Error("No batch available");
  }

  if (!allowedBatches.includes(selectedBatch.toString())) {
    throw new Error("You do not have access to this batch");
  }

  const batch = await Batch.findById(selectedBatch).select(
    "name status startDate endDate",
  );

  const cpSummary = await getStudentSummary(
    studentId,
    "cp",
    null,
    selectedBatch,
  );

  const devSummary = await getStudentSummary(
    studentId,
    "dev",
    null,
    selectedBatch,
  );

  const cpRank = await getStudentRank(studentId, "cp", null, selectedBatch);

  const devRank = await getStudentRank(studentId, "dev", null, selectedBatch);

  return {
    student: {
      id: student._id,
      name: `${student.firstName} ${student.lastName}`,
      email: student.email,
      gender: student.gender,
      currentBatch: student.batch,
      pastBatches: student.batchHistory || [],
    },

    batch,

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

// ============================================================
// 13. GET WEEKLY PROGRESS
// ============================================================

const getWeeklyProgress = async (week, batchId) => {
  if (!batchId) {
    throw new Error("Batch ID is required");
  }

  const students = await User.find({
    role: "student",
    batch: batchId,
  }).select("firstName lastName email gender");

  const results = [];

  for (const student of students) {
    const cp = await getStudentSummary(student._id, "cp", week, batchId);

    const dev = await getStudentSummary(student._id, "dev", week, batchId);

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

// ============================================================
// 14. UNPUBLISH CONTENT
// ============================================================

const unpublishProgressContent = async (contentId) => {
  const content = await ProgressContent.findByIdAndUpdate(
    contentId,
    {
      isPublished: false,
    },
    {
      new: true,
    },
  );

  if (!content) {
    throw new Error("Progress content not found");
  }

  return content;
};

// ============================================================
// EXPORTS
// ============================================================

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
