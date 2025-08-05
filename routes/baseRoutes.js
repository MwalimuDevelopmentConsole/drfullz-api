const express = require('express');
const router = express.Router();
const basePriceController = require('../controllers/basePriceController');
const verifyJWT = require('../middleware/verifyJWT')

// router.use(verifyJWT);

router
    .post('/', basePriceController.createBase)
    .get('/', basePriceController.getAllBases)
    .get('/one/:baseId', basePriceController.getBaseById)
    .patch('/:baseId', basePriceController.updateBase)


module.exports = router
