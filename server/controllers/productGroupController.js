const mongoose = require('mongoose')
const ProductGroup = require('../models/productGroup')
const logger = require('../utils/logger')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')
const uuid = require('uuid')

// Function to create a new product group
const createNewProductGroup = async (productGroupBody) => {
	try {
		logger.info('request received in product group controller to create a new product group')
		const productGroup = new ProductGroup({
			_id: productGroupBody._id,
			name: productGroupBody.name,
			description: productGroupBody.description,
			isActive: productGroupBody.isActive,
		})
		logger.info('product group object created')
		await productGroup.save()
		logger.info('product group saved to DB')
		logger.info('product group created successfully')
		return { _id: productGroup._id }
	} catch (error) {
		logger.error(
			`error in creating product group: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to get all product groups
const getAllProductGroups = async () => {
	try {
		logger.info('request received in product group controller to get all product groups')
		const productGroups = await ProductGroup.find({}, {
			_id: 1,
			name: 1,
			description: 1,
			isActive: 1,
		}).sort({ createdAt: -1 })
		logger.info('product groups fetched from DB')
		return productGroups
	} catch (error) {
		logger.error(
			`error in getting product groups: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to get a product group by ID
const getProductGroupById = async (productGroupId) => {
	try {
		logger.info('request received in product group controller to get a product group')
		const productGroup = await ProductGroup.findById(productGroupId, {
			_id: 1,
			name: 1,
			description: 1,
			isActive: 1,
		})
		if (!productGroup) {
			logger.error('product group not found')
			throw new BadRequestError('Product group not found')
		}
		logger.info('product group fetched from DB')
		return productGroup
	} catch (error) {
		logger.error(
			`error in getting product group: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to update a product group
const updateProductGroupById = async (productGroupId, productGroupBody) => {
	try {
		logger.info('request received in product group controller to update a product group')

		const existingProductGroup = await ProductGroup.findById(productGroupId)
		if (!existingProductGroup) {
			logger.error('product group not found')
			throw new NotFoundError('Product group not found')
		}

		const productGroup = await ProductGroup.findOneAndUpdate(
			{ _id: productGroupId },
			{
				$set: {
					name: productGroupBody.name,
					description: productGroupBody.description,
					isActive: productGroupBody.isActive,
				},
			},
			{
				new: true,
				projection: {
					name: productGroupBody.name ? 1 : 0,
					description: productGroupBody.description ? 1 : 0,
					isActive: productGroupBody.isActive !== undefined ? 1 : 0,
				},
			}
		)

		logger.info('product group updated successfully')
		return productGroup
	} catch (error) {
		logger.error(
			`error in updating product group: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to delete a product group
const deleteProductGroupById = async (productGroupId) => {
	try {
		logger.info('request received in product group controller to delete a product group')

		const existingProductGroup = await ProductGroup.findById(productGroupId)
		if (!existingProductGroup) {
			logger.error('product group not found')
			throw new NotFoundError('Product group not found')
		}

		await ProductGroup.findByIdAndDelete(productGroupId)
		logger.info('product group deleted successfully')
		return { message: 'Product group deleted successfully' }
	} catch (error) {
		logger.error(
			`error in deleting product group: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

module.exports = {
	createNewProductGroup,
	getAllProductGroups,
	getProductGroupById,
	updateProductGroupById,
	deleteProductGroupById,
} 