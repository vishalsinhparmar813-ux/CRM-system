const mongoose = require('mongoose')
const Order = require('../models/order')
const logger = require('../utils/logger')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')
const Client = require('../models/client')
const uuid = require('uuid')
const ClientNumber = require('../models/clientNumber')

// create a new client
const createNewClient = async (
	name,
	alias,
	email,
	mobile,
	correspondenceAddress,
	permanentAddress
) => {
	try {
		logger.info('request received in client controller to create a new client ')
		logger.info(`client address is : ${JSON.stringify(correspondenceAddress)}`)
		// Fetch and increment client number
		let clientNoDoc = await ClientNumber.findOne({})
		if (!clientNoDoc) {
			clientNoDoc = await ClientNumber.create({ clientNo: 1 })
		}
		logger.info(`clientNoDoc is : ${clientNoDoc}`)
		const clientNo = clientNoDoc.clientNo + 1
		logger.info(`clientNo is : ${clientNo}`)
		await ClientNumber.updateOne({}, { clientNo })
		logger.info(`received data: ${clientNo} ${name}, ${alias}, ${email}, ${mobile}, ${correspondenceAddress}, ${permanentAddress}`)

		const clientCorrespondenceAddress = {
			country: correspondenceAddress.country,
			state: correspondenceAddress.state,
			city: correspondenceAddress.city,
			area: correspondenceAddress.area,
			postalCode: correspondenceAddress.postalCode,
			landmark: correspondenceAddress.landmark,
		}
		const clientPermanentAddress = {
			country: permanentAddress.country,
			state: permanentAddress.state,
			city: permanentAddress.city,
			area: permanentAddress.area,
			postalCode: permanentAddress.postalCode,
			landmark: permanentAddress.landmark,
		}
		// Create client
		const clientId = uuid.v4()
		logger.info(`clientId is : ${clientId}`)
		const client = new Client({
			_id: clientId,
			clientNo,
			name,
			alias,
			email,
			mobile,
			correspondenceAddress: clientCorrespondenceAddress,
			permanentAddress: clientPermanentAddress,
		})
		await client.save()
		logger.info('client saved to DB')
		logger.info('client created successfully')
		return client
	} catch (error) {
		logger.error(
			`error in creating client: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// get client by id
const getClientById = async (clientId) => {
	try {
		logger.info(`request received in client controller to get a client by id: ${clientId}`)
		const client = await Client.findOne(
			{ _id: clientId },
			{
				name: 1,
				email: 1,
				mobile: 1,
				correspondenceAddress: 1,
				orders: 1,
			}
		)
		if (!client) {
			logger.error('client not found')
			throw new NotFoundError('Client not found')
		}
		logger.info('client fetched from DB')
        return client
	} catch (error) {
		logger.error(
			`error in getting client: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// get client by email
const getClientByEmail = async (email) => {
	try {
		logger.info('request received in client controller to get a client')
		const client = await Client.findOne(
			{ email },
			{ name: 1, email: 1, phone: 1, orders: 1 }
		)
		if (!client) {
			logger.error('client not found')
			throw new NotFoundError('Client not found')
		}
		logger.info('client fetched from DB')
		return client
	} catch (error) {
		logger.error(
			`error in getting client: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// get client by mobile number
const getClientByMobile = async (mobile) => {
	try {
		logger.info('request received in client controller to get a client by mobile')
		const client = await Client.findOne(
			{ mobile },
			{ name: 1, email: 1, mobile: 1, orders: 1 }
		)
		if (!client) {
			logger.error('client not found')
			throw new NotFoundError('Client not found')
		}
		logger.info('client fetched from DB')
		return client
	} catch (error) {
		logger.error(
			`error in getting client by mobile: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

const getAllClients = async (page = 1, limit = 10) => {
	try {
		logger.info(`request received in client controller to get all clients with pagination - page: ${page}, limit: ${limit}`)
		
		// Convert page and limit to numbers and set defaults
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 10;
		const skip = (pageNum - 1) * limitNum;
		
		// Get total count for pagination
		const totalClients = await Client.countDocuments({});
		const totalPages = Math.ceil(totalClients / limitNum);
		
		// Get paginated clients
		const clients = await Client.find(
			{},
			{
				_id: 1,
				clientNo: 1,
				name: 1,
				alias: 1,
				email: 1,
				mobile: 1,
				correspondenceAddress: 1,
				permanentAddress: 1,
				orders: 1
			}
		)
		.skip(skip)
		.limit(limitNum)
		.sort({ clientNo: 1 }); // Sort by client number
		
		if (!clients) {
			logger.error('clients not found')
			throw new NotFoundError('Clients not found')
		}
		
		logger.info(`clients fetched from DB - total: ${totalClients}, page: ${pageNum}, limit: ${limitNum}, returned: ${clients.length}`)
		
		return {
			clients,
			pagination: {
				currentPage: pageNum,
				totalPages,
				totalClients,
				limit: limitNum,
				hasNextPage: pageNum < totalPages,
				hasPrevPage: pageNum > 1
			}
		}
	} catch (error) {
		logger.error(
			`error in getting clients: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Search clients by name, alias, or mobile number
const searchClients = async (searchTerm, page = 1, limit = 10, suggestion = false) => {
	try {
		logger.info(`request received in client controller to search clients: ${searchTerm}`)
		
		if (!searchTerm || searchTerm.trim() === '') {
			return getAllClients(page, limit);
		}

		// Convert page and limit to numbers and set defaults
		const pageNum = parseInt(page) || 1;
		const limitNum = parseInt(limit) || 10;
		const skip = (pageNum - 1) * limitNum;

		logger.info(`pageNum is : ${pageNum}, limitNum is : ${limitNum}, skip is : ${skip}`)

		const searchRegex = new RegExp(searchTerm, 'i');
		logger.info(`searchRegex is : ${searchRegex}`)
		
		// Get total count for pagination
		const totalClients = await Client.countDocuments({
			$or: [
				{ name: searchRegex },
				{ alias: searchRegex },
				{ mobile: searchRegex }
			]
		});
		const totalPages = Math.ceil(totalClients / limitNum);
		logger.info(`suggestion is : ${suggestion}`)
        // Use minimal projection for suggestions
        const projection = suggestion ? {
            _id: 1,
            clientNo: 1,
            name: 1,
            alias: 1,
            email: 1,
            mobile: 1
        } : {
            _id: 1,
            clientNo: 1,
            name: 1,
            alias: 1,
            email: 1,
            mobile: 1,
            correspondenceAddress: 1,
            permanentAddress: 1,
            orders: 1
        };
		
		const clients = await Client.find(
			{
				$or: [
					{ name: searchRegex },
					{ alias: searchRegex },
					{ mobile: searchRegex }
				]
			},
			projection
		)
		.skip(skip)
		.limit(limitNum)
		.sort({ clientNo: 1 });
		
		logger.info(`found ${clients.length} clients matching search term out of ${totalClients} total`)
		
		return {
			clients,
			pagination: {
				currentPage: pageNum,
				totalPages,
				totalClients,
				limit: limitNum,
				hasNextPage: pageNum < totalPages,
				hasPrevPage: pageNum > 1
			}
		}
	} catch (error) {
		logger.error(
			`error in searching clients: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

const deleteClientById = async (clientId) => {
  return await Client.findByIdAndDelete(clientId)
}

const addOrderId = async(orderId, clientId) => {
	logger.info("request is recieved at push orderId in the client")
	logger.info(`clientId is : ${clientId}, orderId is : ${orderId}`)
	
	await Client.findByIdAndUpdate(clientId,
		{ $push: { orders: orderId } },
		{ new: true, runValidators: true }
		);

	logger.info("order id added to orders in the client");
}


const deleteOrderId = async(orderId, clientId) => {
	logger.info("request it recieved at delete orderId in the client")
	logger.info(`clientId is : ${clientId}, orderId is : ${orderId}`)
	
	await Client.findByIdAndUpdate(clientId, 
		{ $pull: { orders: orderId }}, 
		{ new: true, runValidators: true} 
		);
}

module.exports = {
	createNewClient,
	getClientById,
	getClientByEmail,
	getClientByMobile,
	getAllClients,
	deleteClientById,
	addOrderId,
	deleteOrderId,
	searchClients,
}
