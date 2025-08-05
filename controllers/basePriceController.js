const BasePrice = require("../models/BasePrice");

const createBase = async (req, res) => {
  const { base, price, showDescription=false } = req.body;

  if (!base || !price)
    return res.status(400).json({ message: "All fields are required" });

  try {
    //checking duplicates
    const dupBase = await BasePrice.findOne({
      base: { $regex: base, $options: "i" },
    })
      .lean()
      .exec();

    if (dupBase) {
      return res.status(409).json({ message: "The ssn base already exists!" });
    }

    const basePrice = await BasePrice.create(req.body);
    if (basePrice) {
      res.status(201).json({ message: `Base added successfully` });
    } else {
      res.status(400).json({ message: "Invalid base data received" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getAllBases = async (req, res) => {
  try {
    const [bases, count] = await Promise.all([
      BasePrice.find().lean().exec(),
      BasePrice.countDocuments(),
    ]);

    if (!bases.length) {
      res.status(404).json({ message: `No bases found` });
    } else {
      res.status(200).json({ bases, count });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const updateBase = async (req, res) => {
  const { baseId } = req.params;
  const { base, price, showDescription=false } = req.body;

  if (!baseId || !base || !price)
    return res.status(400).json({ message: "All fields are required" });

  try {
    const basePrice = await BasePrice.findById({ _id: baseId }).exec();
    if (!basePrice) {
      return res.status(404).json({ message: "Base not found" });
    }

    //checking duplicates
    const dupBase = await BasePrice.findOne({
      base: { $regex: base, $options: "i" },
    })
      .lean()
      .exec();

    if (dupBase && dupBase?._id.toString() !== baseId) {
      return res.status(409).json({ message: "The base already exists" });
    }
    basePrice.base = base;
    basePrice.price = price;
    basePrice.showDescription = showDescription;

    
    const basep1 = await basePrice.save();
    res.status(200).json({ message: "Base update successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getBaseById = async (req, res) => {
  const { baseId } = req.params;

  if (!baseId) return res.status(400).json({ message: "base id is required" });

  try {
    const base = await BasePrice.findById({_id: baseId}).lean().exec();
    if (!base) {
      res.status(404).json({ message: `No base found` });
    } else {
      res.status(200).json( base);
    }

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = {
  createBase,
  getAllBases,
  updateBase,
  getBaseById
};
