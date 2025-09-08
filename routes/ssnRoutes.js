const express = require("express");
const router = express.Router();
const ssnController = require("../controllers/ssnController");
const verifyJWT = require("../middleware/verifyJWT");
const csvUploadController = require("../controllers/csvUploadController");
const { upload } = require("../helpers/fileHelper");
const { authenticateToken } = require("../middleware/auth");

// router.use(verifyJWT);

router
  .post("/", ssnController.createSsnDob)
  .post("/checkout", ssnController.checkOutSSNByNumber)
  .post("/upload",  upload.single("file"), csvUploadController.uploadSsn)
  .post("/update/seller", ssnController.updateSellerProductStatus)
  .get("/", ssnController.getAllSsns)
  .get("/all/:sellerId", ssnController.getAllSsnsBySellerId)
  .get("/admin/all", authenticateToken, ssnController.getAllSsnsAdmin)
  .post("/delete", ssnController.deleteProducts);

module.exports = router;
