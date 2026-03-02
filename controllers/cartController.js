// controllers/cartController.js
const Cart = require("../models/Cart");
const SsnDob = require("../models/SsnDob");
const User = require("../models/User");
const { logBalanceChange } = require("./userBalLogController");

// 1. GET CART (The "Auto-Cleaning" Logic)
const getCart = async (req, res) => {
  try {
    const userId = req.user._id; // From auth middleware

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const userBalance = user.balance || 0;

    let cart = await Cart.findOne({ user: userId }).populate({
      path: "items",
      select: "_id price status",
      populate: { path: "price" },
    });

    if (!cart) {
      // Create a new cart object for response (don't save empty cart to DB)
      return res.json({
        cart: { items: [], user: userId },
        userBalance
      });
    }

    // --- CRITICAL LOGIC START ---
    // Check if any dob in the cart is no longer 'Available' (e.g., sold to someone else)
    const validItems = cart.items.filter((dob) => dob.status === "Available");

    // If the number of items changed, it means some dobs were sold/unavailable.
    // We update the DB to reflect this immediately.
    if (validItems.length !== cart.items.length) {
      cart.items = validItems.map((dob) => dob._id);
      await cart.save();
      // Re-populate to send full objects back to frontend
      await cart.populate({
        path: "items",
        select: "_id price status",
        populate: { path: "price" },
      });
    }
    // --- CRITICAL LOGIC END ---

    res.json({ cart, userBalance });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

// 2. ADD TO CART (Handles Single ID or Array of IDs)
const addToCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { dobIds } = req.body; // Expecting { dobIds: ["id1", "id2"] }

    // Normalize input to array even if single string is sent
    const idsToAdd = Array.isArray(dobIds) ? dobIds : [dobIds];

    // 1. Verify availability before adding
    // We only want to add Items that exist and are currently available
    const availableItems = await SsnDob.find({
      _id: { $in: idsToAdd },
      status: "Available",
    });

    if (availableItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Selected Items are no longer available." });
    }

    const validIds = availableItems.map((g) => g._id);

    // 2. Upsert Cart (Create if not exists, update if exists)
    // $addToSet ensures no duplicates of the same dob in the array
    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      { $addToSet: { items: { $each: validIds } } },
      { new: true, upsert: true }
    );

    res.json({ cart });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

// 3. REMOVE ITEM
const removeFromCart = async (req, res) => {
  try {
    const userId = req.user._id;
    // Expecting body: { dobIds: ["id1", "id2"] } or { dobIds: ["id1"] }
    let { dobIds } = req.body;

    console.log(dobIds);

    // Safety Check: Ensure dobIds is actually an array
    // If the frontend sends a single string by mistake, this wraps it in an array
    if (!Array.isArray(dobIds)) {
      dobIds = [dobIds];
    }

    if (!dobIds || dobIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No items selected for removal." });
    }

    const cart = await Cart.findOneAndUpdate(
      { user: userId },
      // $pull with $in: Removes any item in the 'items' array that matches any ID in 'dobIds'
      { $pull: { items: { $in: dobIds } } },
      { new: true }
    );

    console.log(cart);

    res.json({ cart });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

const checkoutItems = async (req, res) => {
  try {
    const userId = req.user.id;

    const cart = await Cart.findOne({ user: userId });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    const dobIds = cart.items;

    console.log(dobIds);

    if (!dobIds || dobIds.length === 0) {
      return res
        .status(400)
        .json({ message: "No items provided for checkout" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // --- STEP 1: CONCURRENCY CHECK ---
    // Find how many of these specific IDs are actually still 'available'
    const availableDobs = await SsnDob.find({
      _id: { $in: dobIds },
      status: "Available",
    }).populate("price");

    // If the found available dobs are fewer than what the user tried to buy,
    // it means someone else bought one of them fractions of a second ago.
    if (availableDobs.length !== dobIds.length) {
      return res.status(409).json({
        message: "One or more items in your cart are no longer available.",
      });
    }

    const totalAmount = availableDobs.reduce((sum, dob) => {
      return sum + (dob.price ? dob.price.price : 0);
    }, 0);

    const userBal = user.balance || 0;

    if (userBal < totalAmount) {
      return res.status(400).json({
        message:
          "Insufficient balance for this purchase. Balance: " +
          userBal.toFixed(2) +
          ", Required: " +
          totalAmount.toFixed(2),
      });
    }

    // Deduct balance
    user.balance = (userBal - totalAmount).toFixed(2);
    await user.save();

    // --- STEP 2: MARK AS SOLD ---
    // Update the Dobs to 'sold' and assign the new owner
    await SsnDob.updateMany(
      { _id: { $in: dobIds } },
      {
        $set: {
          status: "Sold",
          buyerId: userId,
          purchaseDate: new Date(),
        },
      }
    );

    // --- STEP 3: REMOVE FROM *ALL* CARTS ---
    // This executes the logic you requested:
    // "Go through every single cart in the database. If it contains these IDs, pull them out."
    await Cart.updateMany(
      { items: { $in: dobIds } }, // Filter: Find any cart containing these items
      { $pull: { items: { $in: dobIds } } } // Action: Remove these items
    );

    // 1. Group totals by sellerId
    const totalsBySeller = availableDobs.reduce((acc, item) => {
      const sellerId = item.sellerId.toString(); // Ensure consistent string key
      const amount = item?.price?.price || 0;

      if (!acc[sellerId]) {
        acc[sellerId] = 0;
      }

      acc[sellerId] += amount;

      return acc;
    }, {});

    for (const [sellerId, total] of Object.entries(totalsBySeller)) {
      await User.findByIdAndUpdate(
        sellerId,
        { $inc: { balance: total } },
        { new: true }
      );
    }

    res.json({ success: true, message: "Checkout successful" });

    logBalanceChange(user._id, totalAmount, "debit", `N/A`, user.balance).catch(
      (err) => console.error("Error logging balance change:", err)
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Checkout failed", error: error.message });
  }
};

const getMyOrders = async (req, res) => {
  const userId = req.user._id;
  const {
    page = 1,
    limit = 1000,
    cutoffDate = new Date(Date.now() - 120 * 60 * 60 * 1000),
  } = req.query;

  try {
    // Use provided cutoff or calculate 72 hours ago
    let dateFilter = {};
    if (cutoffDate) {
      dateFilter = { purchaseDate: { $gte: new Date(cutoffDate) } };
    } else {
      const seventyTwoHoursAgo = new Date(Date.now() - 72 * 60 * 60 * 1000);
      dateFilter = { purchaseDate: { $gte: seventyTwoHoursAgo } };
    }

    const query = {
      buyerId: userId,
      ...dateFilter,
    };

    console.log(query);

    const orders = await SsnDob.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ purchaseDate: -1 });

    const totalOrders = await SsnDob.countDocuments(query);

    res.json({
      orders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders,
      cutoffDate, // Optional: return the cutoff date used
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to retrieve orders." });
  }
};

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  checkoutItems,
  getMyOrders,
};
