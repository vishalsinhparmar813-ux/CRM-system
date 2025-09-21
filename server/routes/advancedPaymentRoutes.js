const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authenticate = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');
const rolesEnum = require('../enums/roles');
const {
    createAdvancedPayment,
    getClientAdvancedPayments,
    getAvailableBalance,
    useAdvancedPayment,
    getClientAnalytics,
    getAllClientsAnalytics,
    getAdvancedPaymentReceipt
} = require('../controllers/advancedPaymentController');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only .png, .jpg, .jpeg and .pdf files are allowed!'));
        }
    }
});

// Create advanced payment
router.post('/create', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    upload.single('mediaFile'),
    createAdvancedPayment
);

// Get client advanced payments
router.get('/client/:clientId', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    getClientAdvancedPayments
);

// Get available advanced payment balance for a client
router.get('/balance/:clientId', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    getAvailableBalance
);

// Use advanced payment for order
router.post('/use', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    useAdvancedPayment
);

// Get client analytics
router.get('/analytics/:clientId', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    getClientAnalytics
);

// Get all clients analytics summary
router.get('/analytics', 
    authenticate, 
    authorize(rolesEnum.ADMIN), 
    getAllClientsAnalytics
);

// Get advanced payment receipt PDF
router.get('/receipt/:id', 
    authenticate, 
    authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), 
    getAdvancedPaymentReceipt
);

module.exports = router;