const OrderNumber = require('../models/orderNumber')
const uuid = require('uuid')
const logger = require('../utils/logger')

async function initializeOrderNumber() {
	const existing = await OrderNumber.findOne()
	if (!existing) {
		await OrderNumber.create({
			_id: uuid.v4(), // generate a unique ID
			orderNo: 1,
		})
		logger.info('Initialized orderNumber collection with default document.')
	} else {
		logger.info('orderNumber already initialized.')
	}
}

module.exports = initializeOrderNumber
