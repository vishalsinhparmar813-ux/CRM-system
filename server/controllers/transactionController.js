const mongoose = require('mongoose')
const Transaction = require('../models/transaction')
const logger = require('../utils/logger')
const uuid = require('uuid')
const orderController = require('./orderController')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')
const order = require('../models/order')


const createNewTransaction = async (clientId, orderId, amount, mediaFileUrl) => {
	const session = await mongoose.startSession()
	session.startTransaction()

    try{
        logger.info('request received in create transaction')

		const order = await orderController.getOrderById(orderId);

		let totalAmount = 0;
		for (const txnId of order.transactions) {
			const txn = await getTransactionById(txnId);
			if (txn) totalAmount += txn.amount;
		}
		logger.info(`totalAmount: ${totalAmount}, amount: ${amount},  orderAmount: ${order.amount}`)
		if(order.amount - totalAmount < amount){
			logger.info("Invalid amount!. Amount is greater then order's amount!")
			throw new BadRequestError("Invalid amount!. Amount is greater then order's amount!")
		}
		
		const transaction = new Transaction({
			_id: uuid.v4(),
			clientId: clientId,
			orderId: orderId,
			amount: amount,
			date: new Date(),
			mediaFileUrl: mediaFileUrl || null,
		})

		await transaction.save({ session })
		logger.info('transaction saved to DB')
		logger.info('transaction created successfully')

		const txnStatus = totalAmount + amount === order.amount ? "COMPLETED" : "PENDING";

		const orderUpdated = await orderController.updateTXNStatus(orderId, transaction._id, txnStatus)

		await session.commitTransaction()
		session.endSession()

		logger.info('transaction created successfully with transaction')
		return { _id: transaction._id }
	} catch (error) {
		await session.abortTransaction()
		session.endSession()
		logger.error(`Error in creating transaction: ${error.message}`)
		throw error
	}
}


// Function to get all transactions
const getAllTransactionsByOrderId = async (orderId) => {
	try {
		logger.info('request received in transaction controller to get all transactions by order Id')
		
		const order = await orderController.getOrderById(orderId);

		const transactions = [];

		for (const txnId of order.transactions) {
			const txn = await getTransactionById(txnId);
			if(txn) transactions.push(txn)
		}

		logger.info('transactions fetched from DB')
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
