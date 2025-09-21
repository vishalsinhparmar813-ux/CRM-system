const AdvancedPayment = require('../models/advancedPayment');
const Transaction = require('../models/transaction');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Auto-allocate available advanced payments to a new order
 * @param {string} clientId - Client ID
 * @param {string} orderId - Order ID
 * @param {Object} order - Order object
 * @param {mongoose.Session} session - Database session for transaction
 * @returns {Promise<number>} - Total amount allocated
 */
const autoAllocateAdvancedPayments = async (clientId, orderId, order, session) => {
    try {
        logger.info(`Auto-allocating advanced payments for client: ${clientId}, order: ${orderId}`);
        
        // Find all available advanced payments for this client (with remaining amount > 0)
        const availableAdvancedPayments = await AdvancedPayment.find({
            clientId: clientId,
            remainingAmount: { $gt: 0 },
            status: { $ne: 'fully_used' }
        }).sort({ date: 1 }).session(session); // Oldest first (FIFO)
        
        if (!availableAdvancedPayments || availableAdvancedPayments.length === 0) {
            logger.info('No available advanced payments found for auto-allocation');
            return 0;
        }
        
        // Calculate order's remaining amount
        const orderTotal = order.totalAmount || 0;
        const orderPaid = (order.transactions || []).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        let orderRemaining = Math.max(0, orderTotal - orderPaid);
        
        let totalAllocated = 0;
        
        // Process each advanced payment
        for (const advancedPayment of availableAdvancedPayments) {
            if (orderRemaining <= 0) break; // Order is fully paid
            
            const amountToAllocate = Math.min(advancedPayment.remainingAmount, orderRemaining);
            
            if (amountToAllocate > 0) {
                // Create allocation transaction
                const allocationTransaction = new Transaction({
                    _id: uuidv4(),
                    clientId,
                    orderId,
                    amount: amountToAllocate,
                    date: new Date(),
                    transactionType: advancedPayment.transactionType || 'cash',
                    paymentMethod: advancedPayment.paymentMethod || 'Cash',
                    txnNumber: `AP-${advancedPayment._id.toString().slice(-8)}-AUTO`,
                    remarks: `Auto-allocated from advanced payment (${advancedPayment.date.toDateString()})`,
                    mediaFileUrl: advancedPayment.mediaFileUrl,
                    advancedPaymentId: advancedPayment._id
                });
                
                await allocationTransaction.save({ session });
                
                // Add transaction to order
                if (!order.transactions) order.transactions = [];
                order.transactions.push(allocationTransaction._id);
                
                // Update advanced payment
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
                
                await advancedPayment.save({ session });
                
                // Update counters
                totalAllocated += amountToAllocate;
                orderRemaining -= amountToAllocate;
                
                logger.info(`Allocated ${amountToAllocate} from advanced payment ${advancedPayment._id} to order ${orderId}`);
            }
        }
        
        // Save updated order
        await order.save({ session });
        
        logger.info(`Total auto-allocated amount: ${totalAllocated} for order ${orderId}`);
        return totalAllocated;
        
    } catch (error) {
        logger.error(`Error in auto-allocating advanced payments: ${error.message}`);
        throw error;
    }
};

/**
 * Get available advanced payment balance for a client
 * @param {string} clientId - Client ID
 * @returns {Promise<number>} - Total available balance
 */
const getAvailableAdvancedPaymentBalance = async (clientId) => {
    try {
        const result = await AdvancedPayment.aggregate([
            {
                $match: {
                    clientId: clientId,
                    remainingAmount: { $gt: 0 },
                    status: { $ne: 'fully_used' }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAvailable: { $sum: '$remainingAmount' }
                }
            }
        ]);
        
        return result.length > 0 ? result[0].totalAvailable : 0;
    } catch (error) {
        logger.error(`Error getting available advanced payment balance: ${error.message}`);
        return 0;
    }
};

module.exports = {
    autoAllocateAdvancedPayments,
    getAvailableAdvancedPaymentBalance
};
