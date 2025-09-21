const mongoose = require('mongoose')
const Transaction = require('../models/transaction')
const Order = require('../models/order')
const logger = require('../utils/logger')
const uuid = require('uuid')
const orderController = require('./orderController')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')


const createNewTransaction = async (clientId, orderId, amount, mediaFileUrl, order = null, date, transactionType = 'cash', paymentMethod, txnNumber, remarks) => {
	const session = await mongoose.startSession()
	session.startTransaction()

    try{
        logger.info('request received in create transaction')

        // Use existing mediaFileUrl (handled by routes using s3.js)
        let finalMediaFileUrl = mediaFileUrl;

		// Use passed order or fetch if not provided
		let orderData = order;
		if (!orderData) {
			orderData = await orderController.getOrderById(orderId);
			if (!orderData) {
				throw new NotFoundError('Order not found');
			}
		}

		// Validate that the transaction amount doesn't exceed remaining amount
		if (amount > orderData.remainingAmount) {
			logger.info(`Invalid amount! Transaction amount (${amount}) exceeds remaining amount (${orderData.remainingAmount})`);
			throw new BadRequestError(`Invalid amount! Transaction amount exceeds remaining amount of ₹${orderData.remainingAmount}`);
		}
		
		const transaction = new Transaction({
			_id: uuid.v4(),
			clientId: clientId,
			orderId: orderId,
			amount: amount,
			date: date ? new Date(date) : new Date(),
			mediaFileUrl: finalMediaFileUrl || null,
			remarks: remarks || '',
			transactionType: transactionType,
			paymentMethod: paymentMethod || null,
			txnNumber: txnNumber || null,
		})

		await transaction.save({ session })
		logger.info('transaction saved to DB')

		// Calculate new remaining amount
		const newRemainingAmount = orderData.remainingAmount - amount;
		logger.info(`New remaining amount: ${newRemainingAmount}`);

		// Determine transaction status based on remaining amount
		const txnStatus = newRemainingAmount <= 0 ? "COMPLETED" : "PENDING";

		// Update order with new remaining amount, transaction ID, and status
		await orderController.updateOrderWithTransaction(orderId, transaction._id, newRemainingAmount, txnStatus, session);

		await session.commitTransaction()
		session.endSession()

		logger.info('transaction created successfully with transaction')
		return { 
			_id: transaction._id,
			transaction: transaction.toObject(), // Return full transaction data
			newRemainingAmount,
			txnStatus
		}
	} catch (error) {
		await session.abortTransaction()
		session.endSession()
		logger.error(`Error in creating transaction: ${error.message}`)
		throw error
	}
}


// Function to get all transactions (optimized with aggregation)
const getAllTransactionsByOrderId = async (orderId) => {
	try {
		logger.info('request received in transaction controller to get all transactions by order Id')
		
		// Use aggregation to get order and transactions in one query
		const result = await Order.aggregate([
			{ $match: { _id: orderId } },
			{
				$lookup: {
					from: 'transactions',
					localField: 'transactions',
					foreignField: '_id',
					as: 'transactionDetails'
				}
			},
			{
				$project: {
					_id: 1,
					orderNo: 1,
					txnStatus: 1,
					transactionDetails: 1
				}
			}
		]);

		if (result.length === 0) {
			throw new NotFoundError('Order not found');
		}

		const order = result[0];
		const transactions = order.transactionDetails || [];

		logger.info('transactions fetched from DB using aggregation')
		return { transactions, txnStatus: order.txnStatus };
	} catch (error) {
		logger.error(
			`error in getting transactions: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to get a transaction with id
const getTransactionById = async (transactionId) => {
	try{
		logger.info('request received in get trancation by id')
		const trancation = await Transaction.findById(transactionId)
		logger.info('transaction fetched from DB')
		return trancation
	}catch(error){
		logger.error(
			`error in getting trancation: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to delete a transaction by Id
const deleteTransactionById = async (id) => {
	const transaction = await Transaction.findById(
		{_id: id},
		{orderId: 1,}
	)

	await orderController.deleteTxnIdfromOrder(transaction.orderId, id)
  	return await Transaction.findByIdAndDelete(id)
}

module.exports = {
	createNewTransaction,
	getAllTransactionsByOrderId,
	getTransactionById,
	deleteTransactionById
}
