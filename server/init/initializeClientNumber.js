const ClientNumber = require('../models/clientNumber')
const uuid = require('uuid')
const logger = require('../utils/logger')   

async function initializeClientNumber() {
	const existing = await ClientNumber.findOne()
	if (!existing) {
		await ClientNumber.create({
			_id: uuid.v4(),
			clientNo: 1,
		})
		logger.info('Initialized clientNumber collection with default document.')
	} else {
		logger.info('clientNumber already initialized.')
	}
}

module.exports = initializeClientNumber