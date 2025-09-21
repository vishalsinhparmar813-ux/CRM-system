const mongoose = require('mongoose')
const Product = require('../models/product')
const logger = require('../utils/logger')
const {
	BadRequestError,
	InternalServerError,
	NotFoundError,
} = require('../error/error')

// Function to create a new product
const createNewProduct = async (productBody) => {
	try {
		logger.info(
			'request received in product controller to create a new product'
		)
		const product = new Product({
			_id: productBody._id,
			name: productBody.name,
			alias: productBody.alias,
			productGroupId: productBody.productGroupId,
			unitType: productBody.unitType,
			alternateUnits: productBody.alternateUnits,
			ratePerUnit: productBody.ratePerUnit,
		})
		logger.info('product object created')
		await product.save()
		logger.info('product saved to DB')
		logger.info('product created successfully')
		return { _id: product._id }
	} catch (error) {
		logger.error(
			`error in creating product: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to get all products
const getAllProducts = async () => {
	try {
		logger.info('request received in product controller to get all products')
		const products = await Product.find(
			{},
			{
				_id: 1,
				name: 1,
				alias: 1,
				productGroupId: 1,
				unitType: 1,
				alternateUnits: 1,
				ratePerUnit: 1,
			}
		).sort({ createdAt: -1 })
		logger.info('products fetched from DB')
		return products
	} catch (error) {
		logger.error(
			`error in getting products: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to get a product by ID
const getProductById = async (productId) => {
	try {
		logger.info('request received in product controller to get a product')
		const product = await Product.findById(productId, {
			name: 1,
			alias: 1,
			productGroupId: 1,
			unitType: 1,
			alternateUnits: 1,
			ratePerUnit: 1,
		})
		if (!product) {
			logger.error('product not found')
			throw new BadRequestError('Product not found')
		}
		logger.info('product fetched from DB')
		return product
	} catch (error) {
		logger.error(
			`error in getting product: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to update a product
const updateProductById = async (productId, productBody) => {
	try {
		logger.info('request received in product controller to update a product')

		const existingProduct = await Product.findById(productId)
		if (!existingProduct) {
			logger.error('product not found')
			throw new NotFoundError('Product not found')
		}

		const product = await Product.findOneAndUpdate(
			{ _id: productId },
			{
				$set: {
					name: productBody.name,
					alias: productBody.alias,
					productGroupId: productBody.productGroupId,
					unitType: productBody.unitType,
					alternateUnits: productBody.alternateUnits,
					ratePerUnit: productBody.ratePerUnit,
				},
			},
			{
				// projection will return only the updated fields, not the entire document
				new: true, // Return the updated document
				projection: {
					name: productBody.name ? 1 : 0,
					alias: productBody.alias !== undefined ? 1 : 0,
					productGroupId: productBody.productGroupId !== undefined ? 1 : 0,
					unitType: productBody.unitType ? 1 : 0,
					alternateUnits: productBody.alternateUnits !== undefined ? 1 : 0,
					ratePerUnit: productBody.ratePerUnit ? 1 : 0,
				},
			}
		)

		logger.info('product updated successfully')
		return product
	} catch (error) {
		logger.error(
			`error in updating product: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Function to delete a product
const deleteProductById = async (productId) => {
	try {
		logger.info('request received in product controller to delete a product')
		const product = await Product.findById(productId)
		if (!product) {
			logger.error('product not found')
			throw new BadRequestError('Product not found')
		}
		await Product.deleteOne({ _id: productId })
		logger.info('product deleted successfully')
		return { message: 'Product deleted successfully' }
	} catch (error) {
		logger.error(
			`error in deleting product: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

// Search products by name or alias
const searchProducts = async (searchTerm) => {
	try {
		logger.info(`request received in product controller to search products: ${searchTerm}`)
		
		if (!searchTerm || searchTerm.trim() === '') {
			return getAllProducts();
		}

		const searchRegex = new RegExp(searchTerm, 'i');
		const products = await Product.find(
			{
				$or: [
					{ name: searchRegex },
					{ alias: searchRegex }
				]
			},
			{
				_id: 1,
				name: 1,
				alias: 1,
				productGroupId: 1,
				unitType: 1,
				alternateUnits: 1,
				ratePerUnit: 1,
			}
		).sort({ createdAt: -1 })
		
		logger.info(`found ${products.length} products matching search term`)
		return products
	} catch (error) {
		logger.error(
			`error in searching products: ${error.status || 'unknown status'} ${
				error.message
			}`
		)
		throw error
	}
}

module.exports = {
	createNewProduct,
	getAllProducts,
	getProductById,
	updateProductById,
	deleteProductById,
	searchProducts,
}
