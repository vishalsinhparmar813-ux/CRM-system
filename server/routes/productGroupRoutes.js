const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/auth')
const authorize = require('../middlewares/authorize')
const logger = require('../utils/logger')
const rolesEnum = require('../enums/roles')
const productGroupController = require('../controllers/productGroupController')
const errorHandler = require('../error/error')
const uuid = require('uuid')

/**
 * @POST
 * @desc Create a new product group
 * @access Admin
 */
router.post('/', authenticate, authorize(rolesEnum.ADMIN), async(req, res) => {
	try {
		logger.info('request received to create a new product group')
		const { name, description, isActive } = req.body
        
		if (!name) {
			return res
				.status(400)
				.json({ message: 'Product group name is required' })
		}

        logger.info("request body validations passed")
		const productGroupBody = {
			_id: uuid.v4(),
			name,
			description: description || '',
			isActive: isActive !== undefined ? isActive : true,
		}
        logger.info("forwarding request to product group controller")
		const productGroup = await productGroupController.createNewProductGroup(productGroupBody)
		res.json({ message: 'Product group created successfully', productGroup })
	} catch (error) {
		logger.error('Error creating product group:', error)
        errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Get all product groups
 * @access Admin
 */
router.get('/all', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to get all product groups')
		const productGroups = await productGroupController.getAllProductGroups()
		res.json(productGroups)
	} catch (error) {
		logger.error('Error getting product groups:', error)
		errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Get a product group by ID
 * @access Admin
 */
router.get('/:productGroupId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to get a product group by ID')
		const { productGroupId } = req.params
		if (!productGroupId) {
			return res.status(400).json({ message: 'Product group ID is required' })
		}
		const productGroup = await productGroupController.getProductGroupById(productGroupId)
		res.json(productGroup)
	} catch (error) {
		logger.error('Error getting product group:', error)
		errorHandler(error, req, res)
	}
})

/**
 * @PATCH
 * @desc Update a product group by ID
 * @access Admin
 */
router.patch('/:productGroupId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info(`request received to update a product group by ID: ${req.params.productGroupId}`)
        const { productGroupId } = req.params
        if (!productGroupId) {
            return res.status(400).json({ message: 'Product group ID is required' })
        }
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ message: 'Invalid or missing request body' })
        }
        const { name, description, isActive } = req.body
        const updatedProductGroupBody = {}
        if (name) {
            updatedProductGroupBody.name = name
        }
        if (description !== undefined) {
            updatedProductGroupBody.description = description
        }
        if (isActive !== undefined) {
            updatedProductGroupBody.isActive = isActive
        }
        if (Object.keys(updatedProductGroupBody).length === 0) {
            return res.status(400).json({ message: 'No fields to update' })
        }
        const updatedProductGroup = await productGroupController.updateProductGroupById(productGroupId, updatedProductGroupBody)
        res.json({ message: 'Product group updated successfully', productGroup: updatedProductGroup })
    } catch (error) {
        logger.error('Error updating product group:', error)
        errorHandler(error, req, res)
    }
})

/**
 * @DELETE
 * @desc Delete a product group by ID
 * @access Admin
 */
router.delete('/:productGroupId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info('request received to delete a product group by ID')
        const { productGroupId } = req.params
        if (!productGroupId) {
            return res.status(400).json({ message: 'Product group ID is required' })
        }
        await productGroupController.deleteProductGroupById(productGroupId)
        res.status(200).json({ message: 'Product group deleted successfully' })
    } catch (error) {
        logger.error('Error deleting product group:', error)
        errorHandler(error, req, res)
    }
})

module.exports = router 