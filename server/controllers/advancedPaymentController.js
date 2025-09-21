const AdvancedPayment = require('../models/advancedPayment');
const Client = require('../models/client');
const Order = require('../models/order');
const Transaction = require('../models/transaction');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const { generateAdvancedPaymentReceiptPDF } = require('../utils/pdfGenerator');
const { uploadFileToS3 } = require('../utils/s3');
const clientController = require('./clientController');
const constants = require('../constants');
// Create new advanced payment
const createAdvancedPayment = async (req, res) => {
    try {
        const { clientId, orderId, amount, date, transactionType, paymentMethod, txnNumber, remarks } = req.body;
        
        // Validate required fields
        if (!clientId || !amount || !date) {
            return res.status(400).json({ message: 'Client ID, amount, and date are required' });
        }

        // Validate client exists
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Validate amount
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        let order = null;
        // If orderId is provided, validate it exists and belongs to client
        if (orderId && orderId.trim() !== '') {
            order = await Order.findById(orderId);
            if (!order) {
                return res.status(404).json({ message: 'Order not found' });
            }
            if (order.clientId !== clientId) {
                return res.status(400).json({ message: 'Order does not belong to this client' });
            }
        }

        // Handle file upload using existing s3.js approach
        let mediaFileUrl = null;
        if (req.file) {
            try {
                
                // Get client name for S3 path organization
                const client = await clientController.getClientById(clientId);
                const userName = client?.name?.replace(/\s+/g, '_').toLowerCase() || 'unknown_user';
                const today = new Date().toISOString().slice(0, 10);
                const serverName = constants.NODE_ENV;
                const s3Key = `${userName}/${serverName}/advanced-payments/${today}/${Date.now()}_${req.file.originalname}`;
                
                mediaFileUrl = await uploadFileToS3({
                    buffer: req.file.buffer,
                    key: s3Key,
                    mimetype: req.file.mimetype,
                });
                
            } catch (uploadError) {
                logger.error(`File upload error in advanced payment: ${uploadError.message}`);
                // Continue without file if upload fails
                mediaFileUrl = null;
            }
        }

        const advancedPayment = new AdvancedPayment({
            _id: uuidv4(),
            clientId,
            orderId: order ? orderId : null,
            amount: numAmount,
            remainingAmount: numAmount,
            date: new Date(date),
            transactionType: transactionType || 'cash',
            paymentMethod,
            txnNumber,
            remarks: remarks || '',
            mediaFileUrl,
            usageHistory: []
        });

        await advancedPayment.save();

        // If order is specified, automatically allocate the payment to reduce order's remaining amount
        if (order) {
            // Calculate current remaining amount for the order
            const orderTotal = order.totalAmount || 0;
            const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            const orderRemaining = Math.max(0, orderTotal - orderPaid);
            
            // Determine how much to allocate (minimum of payment amount and order remaining)
            const amountToAllocate = Math.min(numAmount, orderRemaining);
            
            if (amountToAllocate > 0) {
                // Create a transaction record for this allocation using 'cash' type instead of 'advanced_payment'
                const allocationTransaction = new Transaction({
                    _id: uuidv4(),
                    clientId,
                    orderId,
                    amount: amountToAllocate,
                    date: new Date(date),
                    transactionType: transactionType || 'cash', // Use the original transaction type
                    paymentMethod: paymentMethod || 'Cash',
                    txnNumber: txnNumber || `AP-${advancedPayment._id.toString().slice(-8)}`,
                    remarks: remarks || 'Advanced payment',
                    mediaFileUrl
                });

                await allocationTransaction.save();

                // Add transaction to order
                if (!order.transactions) order.transactions = [];
                order.transactions.push(allocationTransaction._id);
                await order.save();

                // Update advanced payment usage
                advancedPayment.remainingAmount -= amountToAllocate;
                advancedPayment.usageHistory.push({
                    orderId,
                    orderNo: order.orderNo,
                    amountUsed: amountToAllocate,
                    dateUsed: new Date(),
                    remarks: `Auto-allocated to order #${order.orderNo}`
                });

                if (advancedPayment.remainingAmount === 0) {
                    advancedPayment.status = 'fully_used';
                }

                await advancedPayment.save();
            }
        }

        logger.info(`Advanced payment created: ${advancedPayment._id} for client: ${clientId}${order ? ` with order allocation: ${order.orderNo}` : ' without order allocation'}`);

        // Generate PDF receipt
        try {
            const pdfBuffer = await generateAdvancedPaymentReceiptPDF({
                advancedPayment,
                client,
                order
            });

            // Set response headers for PDF download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="advanced-payment-receipt-${advancedPayment._id.toString().slice(-8)}.pdf"`);
            res.setHeader('Content-Length', pdfBuffer.length);
            
            // Send PDF as response
            res.send(pdfBuffer);

        } catch (pdfError) {
            logger.error(`Error generating PDF: ${pdfError.message}`);
            // If PDF generation fails, still return success response
            res.status(201).json({
                success: true,
                message: 'Advanced payment created successfully (PDF generation failed)',
                advancedPaymentId: advancedPayment._id,
                advancedPayment,
                pdfError: 'PDF generation failed'
            });
        }

    } catch (error) {
        logger.error(`Error creating advanced payment: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get available advanced payment balance for a client
const getAvailableBalance = async (req, res) => {
    try {
        const { clientId } = req.params;
        const { getAvailableAdvancedPaymentBalance } = require('../utils/advancedPaymentAllocation');
        
        const availableBalance = await getAvailableAdvancedPaymentBalance(clientId);
        
        res.status(200).json({
            success: true,
            availableBalance
        });
        
    } catch (error) {
        logger.error(`Error getting available balance: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get all advanced payments for a client
const getClientAdvancedPayments = async (req, res) => {
    try {
        const { clientId } = req.params;

        const advancedPayments = await AdvancedPayment.find({ clientId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            advancedPayments,
            count: advancedPayments.length
        });

    } catch (error) {
        logger.error(`Error fetching advanced payments: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Use advanced payment for an order
const useAdvancedPayment = async (req, res) => {
    try {
        const { advancedPaymentId, orderId, amountToUse, remarks } = req.body;

        if (!advancedPaymentId || !orderId || !amountToUse) {
            return res.status(400).json({ message: 'Advanced payment ID, order ID, and amount are required' });
        }

        const advancedPayment = await AdvancedPayment.findById(advancedPaymentId);
        if (!advancedPayment) {
            return res.status(404).json({ message: 'Advanced payment not found' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const numAmountToUse = Number(amountToUse);
        if (isNaN(numAmountToUse) || numAmountToUse <= 0) {
            return res.status(400).json({ message: 'Amount to use must be a positive number' });
        }

        if (numAmountToUse > advancedPayment.remainingAmount) {
            return res.status(400).json({ 
                message: `Insufficient advanced payment balance. Available: ₹${advancedPayment.remainingAmount}` 
            });
        }

        // Update advanced payment
        advancedPayment.remainingAmount -= numAmountToUse;
        advancedPayment.usageHistory.push({
            orderId,
            orderNo: order.orderNo,
            amountUsed: numAmountToUse,
            dateUsed: new Date(),
            remarks: remarks || ''
        });

        if (advancedPayment.remainingAmount === 0) {
            advancedPayment.status = 'fully_used';
        }

        await advancedPayment.save();

        res.status(200).json({
            success: true,
            message: 'Advanced payment used successfully',
            advancedPayment,
            amountUsed: numAmountToUse,
            remainingAmount: advancedPayment.remainingAmount
        });

    } catch (error) {
        logger.error(`Error using advanced payment: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get comprehensive client analytics
const getClientAnalytics = async (req, res) => {
    try {
        const { clientId } = req.params;

        // Validate client exists
        const client = await Client.findById(clientId);
        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        // Get client orders with transactions
        const orders = await Order.find({ clientId }).populate('transactions');
        
        // Get advanced payments
        const advancedPayments = await AdvancedPayment.find({ clientId });

        // Calculate order statistics
        const totalOrders = orders.length;
        const completedOrders = orders.filter(order => order.status === 'COMPLETED').length;
        const pendingOrders = orders.filter(order => order.status === 'PENDING').length;
        const cancelledOrders = orders.filter(order => order.status === 'CANCELLED').length;
        const closedOrders = orders.filter(order => order.status === 'CLOSED').length;

        // Calculate financial data
        let totalOrderValue = 0;
        let totalPaid = 0;
        let outstandingAmount = 0;

        orders.forEach(order => {
            const orderTotal = order.totalAmount || 
                (Array.isArray(order.products) ? order.products.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) : 0);
            const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
            
            totalOrderValue += orderTotal;
            totalPaid += orderPaid;
            
            if (order.status !== 'CANCELLED' && order.status !== 'CLOSED') {
                outstandingAmount += Math.max(0, orderTotal - orderPaid);
            }
        });

        // Calculate advanced payment data
        const totalAdvancedPayments = advancedPayments.reduce((sum, ap) => sum + ap.amount, 0);
        const availableAdvancedPayments = advancedPayments.reduce((sum, ap) => sum + ap.remainingAmount, 0);
        const usedAdvancedPayments = totalAdvancedPayments - availableAdvancedPayments;

        // Get recent transactions
        const recentTransactions = await Transaction.find({ clientId }).sort({ createdAt: -1 }).limit(10);

        const analytics = {
            client: {
                id: client._id,
                name: client.name,
                email: client.email,
                mobile: client.mobile
            },
            orders: {
                total: totalOrders,
                completed: completedOrders,
                pending: pendingOrders,
                cancelled: cancelledOrders,
                closed: closedOrders
            },
            financial: {
                totalOrderValue: Math.round(totalOrderValue * 100) / 100,
                totalPaid: Math.round(totalPaid * 100) / 100,
                outstandingAmount: Math.round(outstandingAmount * 100) / 100,
                totalAdvancedPayments: Math.round(totalAdvancedPayments * 100) / 100,
                availableAdvancedPayments: Math.round(availableAdvancedPayments * 100) / 100,
                usedAdvancedPayments: Math.round(usedAdvancedPayments * 100) / 100
            },
            advancedPayments: {
                count: advancedPayments.length,
                activeCount: advancedPayments.filter(ap => ap.status === 'active').length,
                fullyUsedCount: advancedPayments.filter(ap => ap.status === 'fully_used').length,
                refundedCount: advancedPayments.filter(ap => ap.status === 'refunded').length,
                list: advancedPayments
            },
            recentTransactions: recentTransactions.slice(0, 5)
        };

        res.status(200).json({ 
            success: true,
            analytics 
        });

    } catch (error) {
        logger.error(`Error fetching client analytics: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get all clients analytics summary
const getAllClientsAnalytics = async (req, res) => {
    try {
        const clients = await Client.find({});
        const orders = await Order.find({});
        const advancedPayments = await AdvancedPayment.find({});
        const transactions = await Transaction.find({});

        const summary = {
            totalClients: clients.length,
            totalOrders: orders.length,
            totalAdvancedPayments: advancedPayments.length,
            totalTransactions: transactions.length,
            totalAdvancedAmount: advancedPayments.reduce((sum, ap) => sum + ap.amount, 0),
            availableAdvancedAmount: advancedPayments.reduce((sum, ap) => sum + ap.remainingAmount, 0)
        };

        res.status(200).json({
            success: true,
            summary
        });

    } catch (error) {
        logger.error(`Error fetching all clients analytics: ${error.message}`);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

// Get advanced payment receipt PDF
const getAdvancedPaymentReceipt = async (req, res) => {
    try {
        const { id } = req.params;

        // Find the advanced payment
        const advancedPayment = await AdvancedPayment.findById(id);
        if (!advancedPayment) {
            return res.status(404).json({ success: false, message: "Advanced payment not found" });
        }

        // Get client information
        const client = await Client.findById(advancedPayment.clientId);
        if (!client) {
            return res.status(404).json({ success: false, message: "Client not found" });
        }

        // Get order information if orderId exists
        let order = null;
        if (advancedPayment.orderId) {
            order = await Order.findById(advancedPayment.orderId);
        }

        // Generate PDF receipt
        const pdfBuffer = await generateAdvancedPaymentReceiptPDF({
            advancedPayment,
            client,
            order
        });

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="advanced-payment-receipt-${advancedPayment._id}.pdf"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error("Error generating advanced payment receipt:", error);
        res.status(500).json({ success: false, message: "Failed to generate receipt" });
    }
};

module.exports = {
    createAdvancedPayment,
    getClientAdvancedPayments,
    getAvailableBalance,
    useAdvancedPayment,
    getClientAnalytics,
    getAllClientsAnalytics,
    getAdvancedPaymentReceipt
};