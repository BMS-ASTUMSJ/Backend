const Batch = require("../models/Batch");


const createBatch = async (req, res) => {
  try {
    const { name, startDate, endDate, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Batch name is required (e.g., 'Batch 2')",
      });
    }

    const existingBatch = await Batch.findOne({ name: name.trim() });
    if (existingBatch) {
      return res.status(409).json({
        success: false,
        message: "A batch with this name already exists",
      });
    }

    const batch = await Batch.create({
      name: name.trim(),
      startDate,
      endDate,
      description,
      isRegistrationOpen: false,
    });

    return res.status(201).json({
      success: true,
      message: "Batch created successfully",
      batch,
    });
  } catch (error) {
    console.error("Create batch error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating batch",
    });
  }
}
const getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: batches.length,
      batches,
    });
  } catch (error) {
    console.error("Get batches error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching batches",
    });
  }
};


const getActiveRegistrationBatch = async (req, res) => {
  try {
    const activeBatch = await Batch.findOne({ isRegistrationOpen: true });

    return res.status(200).json({
      success: true,
      isRegistrationOpen: !!activeBatch,
      activeBatch: activeBatch || null,
    });
  } catch (error) {
    console.error("Get active batch error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching active batch status",
    });
  }
};


const toggleBatchRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRegistrationOpen } = req.body;

    const batch = await Batch.findById(id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    
    if (isRegistrationOpen === true) {
      await Batch.updateMany({ _id: { $ne: id } }, { isRegistrationOpen: false });
    }

    batch.isRegistrationOpen =
      isRegistrationOpen !== undefined ? isRegistrationOpen : !batch.isRegistrationOpen;
    await batch.save();

    return res.status(200).json({
      success: true,
      message: `Registration for ${batch.name} is now ${
        batch.isRegistrationOpen ? "OPEN" : "CLOSED"
      }`,
      batch,
    });
  } catch (error) {
    console.error("Toggle registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while toggling registration",
    });
  }
};

module.exports = {
  createBatch,
  getBatches,
  getActiveRegistrationBatch,
  toggleBatchRegistration,
};