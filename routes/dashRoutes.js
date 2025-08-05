const express = require("express");
const router = express.Router();
const dashController = require("../controllers/dashController");
const verifyJWT = require("../middleware/verifyJWT");

// router.use(verifyJWT);

router.get("/", dashController.getDashStats);

module.exports = router;
