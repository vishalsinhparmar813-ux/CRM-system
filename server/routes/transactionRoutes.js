const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/auth')
const authorize = require('../middlewares/authorize')
const logger = require('../utils/logger')
const rolesEnum = require('../enums/roles')
const transactionController = require('../controllers/transactionController')
const clientController = require('../controllers/clientController')
const orderController = require('../controllers/orderController')
const roles = require('../enums/roles')
const generateTransactionReceiptPDF = require('../utils/pdfGenerator').generateTransactionReceiptPDF;
const Product = require('../models/product');
const multer = require('multer');
const upload = multer();
const { uploadFileToS3 } = require('../utils/s3');
const jwt = require('jsonwebtoken');
const constants = require('../constants')

const errorHandler = (error, req, res, next) => {
    if (error.statusCode && error.statusCode === 400) {
        return res.status(400).json({ message: error.message })
    }
    if (error.statusCode && error.statusCode === 404) {
        return res.status(404).json({ message: error.message })
    }
    logger.error(`Error: ${error.message}`)
    res.status(500).json({ message: 'Internal server error' })
}


/**
 * @POST
 * @desc make transaction for completed orders
 * @access Admin
 * 
 */

router.post('/pay', authenticate, authorize(rolesEnum.ADMIN), upload.single('mediaFile'), async(req, res) => {
    try{
        logger.info('request recieved to make payment');
        
        console.log('request body:', req.body)

        const { clientId, orderId, amount} = req.body;
        let mediaFileUrl = null;
        if (req.file) {
            // Get user name (for S3 path)
            const client = await clientController.getClientById(clientId);
            const userName = client?.name?.replace(/\s+/g, '_').toLowerCase() || 'unknown_user';
            const today = new Date().toISOString().slice(0, 10);
            const ext = req.file.originalname.split('.').pop();
            const serverName = constants.NODE_ENV;
            const s3Key = `${userName}/${serverName}/transactions/${today}/${Date.now()}_${req.file.originalname}`;
            mediaFileUrl = await uploadFileToS3({
                buffer: req.file.buffer,
                key: s3Key,
                mimetype: req.file.mimetype,
            });
        }

        if (!clientId) {
			return res.status(400).json({ message: 'Client ID is required' })
		}
		if (!orderId) {
			return res.status(400).json({ message: 'Order ID is required' })
		}
		if (amount <= 0 || !amount) {
			return res.status(400).json({ message: 'Invailid amount' })
		}

        const client = await clientController.getClientById(clientId)
		if (!client) {
			return res.status(404).json({ message: 'Client not found' })
		}
		const order = await orderController.getOrderById(orderId)
		if (!order) {
			return res.status(404).json({ message: 'Order not found' })
		}
		logger.info('client and order fetched from DB')


        const transaction = await transactionController.createNewTransaction(
			clientId,
            orderId,
            amount,
            mediaFileUrl // pass to controller
		)
		if (!transaction) {
			return res.status(500).json({ message: 'Error in creating transaction' })
		}
		logger.info('Transaction created successfully')
		res.status(201).json({
			message: 'Transaction created successfully',
			transactionId: transaction._id,
			mediaFileUrl,
		})
	} catch (error) {
		logger.error(`Error in creating transaction: ${error.message}`)
		errorHandler(error, req, res)
		res.status(500).json({ message: 'Internal server error' })
	}
})

/**
 * @GET
 * @desc Get all transactions
 * @access Admin
 * 
 */
router.get('/txns/:orderId', authenticate, authorize(rolesEnum.ADMIN), async(req, res) => {
	try {
		const { orderId } = req.params
		logger.info('request recieved to get transactions')

		const transactions = await transactionController.getAllTransactionsByOrderId(orderId);

		res.json({ message: 'Transactions fetched successfully', transactions})
	} catch (error) {
		logger.error('Error fetching transactions:', error)
        errorHandler(error, req, res)
	}
})


router.get('/:transactionId', authenticate, authorize(rolesEnum.ADMIN), async(req, res) => {
	try {
		const { transactionId } = req.params
		logger.info('request recieved to get transactions')

		const transaction = await transactionController.getTransactionById(transactionId);

		res.json({ message: 'Transactions fetched successfully', transaction})
	} catch (error) {
		logger.error('Error fetching get transaction:', error)
        errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Generate transaction receipt PDF by transaction ID
 * @access Admin
 */
router.get('/receipt/:transactionId', async (req, res) => {
    try {
        // Accept token from header or query param
        let token = req.headers['authorization'];
        if (token && token.startsWith('Bearer ')) {
            token = token.slice(7);
        } else if (req.query.token) {
            token = req.query.token;
        }
        if (!token) {
            return res.status(401).json({ message: 'Authorization token missing or invalid' });
        }
        // VERIFY THE TOKEN!
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({ message: 'Authorization token missing or invalid' });
        }
        // Get transaction
        const { transactionId } = req.params;
        const transaction = await transactionController.getTransactionById(transactionId);
        logger.info('[RECEIPT DEBUG] transaction:', JSON.stringify(transaction));
        if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
        // Get order
        const order = await orderController.getOrderById(transaction.orderId);
        logger.info('[RECEIPT DEBUG] order:', JSON.stringify(order));
        if (!order) return res.status(404).json({ message: 'Order not found' });
        // Get client
        const client = await clientController.getClientById(transaction.clientId);
        logger.info('[RECEIPT DEBUG] client:', JSON.stringify(client));
        if (!client) return res.status(404).json({ message: 'Client not found' });
        // Get product details for all products in the order
        let products = [];
        if (Array.isArray(order.products)) {
            products = await Promise.all(order.products.map(async (p) => {
                const prod = await Product.findById(p.productId);
                return {
                    name: prod ? prod.name : p.productId,
                    quantity: p.quantity,
                    unitType: p.unitType,
                    amount: p.amount,
                };
            }));
        }
        logger.info('[RECEIPT DEBUG] products:', JSON.stringify(products));
        // If products is empty, add a test product for debug
        if (products.length === 0) {
            products = [{ name: 'DEBUG TEST PRODUCT', quantity: 1, unitType: 'unit', amount: 123 }];
        }
        // Generate PDF
        const pdfBuffer = await generateTransactionReceiptPDF({ transaction, order, client, products });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename=receipt_${transaction._id}.pdf`,
        });
        return res.send(pdfBuffer);
    } catch (error) {
        logger.error('Error generating transaction receipt PDF:', error);
        return res.status(500).json({ message: 'Failed to generate receipt PDF' });
    }
});


router.delete('/:transactionId', authenticate, authorize(rolesEnum.ADMIN), async(req, res) => {
	try{
		const {transactionId} = req.params
		logger.info('request recieved to delete transactions')
		await transactionController.deleteTransactionById(transactionId)

		res.json({message: 'Transaction Deleted Successfully'})
	}catch(error){ 
		logger.error('Error fetching delete transaction', error)
		errorHandler(error, req, res)
	}
})


module.exports = router
