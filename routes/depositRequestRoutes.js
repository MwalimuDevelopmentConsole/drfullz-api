const express = require('express');
const router = express.Router();
const depositRequestController = require('../controllers/depositRequestController');
const { authenticateToken, isAdmin, isStaff } = require('../middleware/auth');

// Support user creates request
router.post('/create', authenticateToken, isStaff, depositRequestController.createRequest);

// Get list of requests
router.get('/', authenticateToken, isStaff, depositRequestController.getRequests);

// Support user provides extra details
router.post('/:id/details', authenticateToken, isStaff, depositRequestController.provideDetails);

// Admin updates request status (approve, reject, requested_details)
router.patch('/admin/:id/status', authenticateToken, isAdmin, depositRequestController.updateRequestStatus);

// Admin gets pending count for sidebar
router.get('/admin/pending-count', authenticateToken, isAdmin, depositRequestController.getPendingCount);

module.exports = router;
