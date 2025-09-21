const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/auth')
const authorize = require('../middlewares/authorize')
const logger = require('../utils/logger')
const rolesEnum = require('../enums/roles')
const productUnitsEnum = require('../enums/productUnits')
const uuid = require('uuid')
const productController = require('../controllers/productController')

const errorHandler = (error, req, res, next) => {
    if (error.statusCode && error.statusCode === 400) {
        return res.status(400).json({ message: error.message })
    }
    if (error.statusCode && error.statusCode === 404) {
        return res.status(404).json({ message: error.message })
    }
    logger.error(`Error: ${error.message}`)
    res.status(500).json({ message: 'Internal server error' })
}

/**
 * @POST
 * @desc Create a new product
 * @access Admin
 * 
 * @status tested and working
 */
router.post('/', authenticate, authorize(rolesEnum.ADMIN), async(req, res) => {
	try {
        console.log(req.body)
		logger.info('request recieved to create a new product')
		const { name, alias, productGroupId, unitType, alternateUnits, ratePerUnit } = req.body
        
		if (!name) {
			return res
				.status(400)
				.json({ message: 'Product name is required' })
		}
        if (!unitType) {
            return res.status(400).json({ message: 'Product unit type is required' })
        }
        if (!ratePerUnit) {
            return res.status(400).json({ message: 'Product rate per unit is required' })
        }
		if (!productUnitsEnum[unitType]) {
			return res.status(400).json({ message: 'Invalid product units' })
		}
		// Handle alternateUnits validation
		if (alternateUnits) {
			// Validate alternateUnits if provided
			if (
				!alternateUnits.numberOfItems ||
				!alternateUnits.numberOfUnits
			) {
				return res
					.status(400)
					.json({
						message:
							'Alternate units must have numberOfItems and numberOfUnits',
					})
			}
		}
        logger.info("request body validations passed")
		const productBody = {
			_id: uuid.v4(),
			name,
			alias,
			productGroupId,
			unitType,
			alternateUnits: unitType === productUnitsEnum.SET ? null : alternateUnits,
			ratePerUnit,
		}
        logger.info("forwarding request to product controller")
		const product = await productController.createNewProduct(productBody)
		res.json({ message: 'Product created successfully', product })
	} catch (error) {
		logger.error('Error creating product:', error)
        errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Get all products
 * @access Admin
 * 
 * @status tested and working
 */
router.get('/all', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
	try {
		logger.info('request recieved to get all products')
		const products = await productController.getAllProducts()
		res.status(200).json({ message: 'Products fetched successfully', products })
	} catch (error) {
		logger.error('Error getting products:', error)
		errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Search products by name or alias
 * @access Admin
 */
router.get('/search/:searchTerm', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
	try {
		logger.info('request received to search products')
		const { searchTerm } = req.params
		if (!searchTerm) {
			return res.status(400).json({ message: 'Search term is required' })
		}
		const products = await productController.searchProducts(searchTerm)
		res.status(200).json({ message: 'Products searched successfully', products })
	} catch (error) {
		logger.error('Error searching products:', error)
		errorHandler(error, req, res)
	}
})

/**
 * @GET
 * @desc Get a product by ID
 * @access Admin
 * 
 * @status tested and working
 */
router.get('/:productId', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
    try {
        logger.info('request recieved to get a product by ID')
        const { productId } = req.params
        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' })
        }
        const product = await productController.getProductById(productId)
        res.status(200).json({ message: 'Product fetched successfully', product })
    } catch (error) {
        logger.error('Error getting product:', error)
        errorHandler(error, req, res)
    }
})

/**
 * @PUT
 * @desc Update a product by ID
 * @access Admin
 */
router.patch('/:productId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info(`request recieved to update a product by ID: ${req.params.productId}`)
        const { productId } = req.params
        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' })
        }
        const { name, unitType, alternateUnits, ratePerUnit } = req.body
        const updatedProductBody = {}
        if (name) {
            updatedProductBody.name = name
        }
        if (unitType) {
            if (!productUnitsEnum[unitType]) {
                return res.status(400).json({ message: 'Invalid product unitType' })
            }
            updatedProductBody.unitType = unitType
        }
        if (ratePerUnit) {
            updatedProductBody.ratePerUnit = ratePerUnit
        }
        // Handle alternateUnits validation
        if (alternateUnits) {
            // Validate alternateUnits if provided
            if (
                !alternateUnits.numberOfItems ||
                !alternateUnits.numberOfUnits
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            'Alternate units must have numberOfItems and numberOfUnits',
                    })
            }
            updatedProductBody.alternateUnits = alternateUnits
        } else if (unitType === productUnitsEnum.SET) {
            // For SET unit type, explicitly set alternateUnits to null
            updatedProductBody.alternateUnits = null;
        }
        if (Object.keys(updatedProductBody).length === 0) {
            return res.status(400).json({ message: 'No fields to update' })
        }
        const updatedProduct = await productController.updateProductById(productId, updatedProductBody)
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' })
        }
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct })
    } catch (error) {
        logger.error('Error updating product:', error)
        errorHandler(error, req, res)
    }   
}
)

/**
 * @DELETE
 * @desc Delete a product by ID
 * @access Admin
 */

router.delete('/:productId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info('request recieved to delete a product by ID')
        const { productId } = req.params
        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' })
        }
        await productController.deleteProductById(productId)
        res.status(200).json({ message: 'Product deleted successfully' })
    } catch (error) {
        logger.error('Error deleting product:', error)
        errorHandler(error, req, res)
    }
}
)

/**
 * @GET
 * @desc Search products by name or alias
 * @access Admin
 */
router.get('/search/:searchTerm', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to search products')
		const { searchTerm } = req.params
		if (!searchTerm) {
			return res.status(400).json({ message: 'Search term is required' })
		}
		const products = await productController.searchProducts(searchTerm)
		res.status(200).json(products)
	} catch (error) {
		logger.error('Error searching products:', error)
		errorHandler(error, req, res)
	}
})

module.exports = router
