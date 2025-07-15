// routes/orders.js
const express = require('express')
const router = express.Router()
const authenticate = require('../middlewares/auth')
const authorize = require('../middlewares/authorize')
const logger = require('../utils/logger')
const rolesEnum = require('../enums/roles')
const orderController = require('../controllers/orderController')
const clientController = require('../controllers/clientController')
const productController = require('../controllers/productController')
const productUnitEnum = require('../enums/productUnits')
const generateInvoicePDF = require('../utils/pdfGenerator');

/**
 * @POST
 * @desc Create a new order
 * @access Admin
 */
router.post('/', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to create a new order')
		const { clientId, products, dueDate } = req.body;
		console.log('request body:', req.body)

		if (!clientId) {
			return res.status(400).json({ message: 'Client ID is required' })
		}
		if (!Array.isArray(products) || products.length === 0) {
			return res.status(400).json({ message: 'At least one product is required' })
		}
		for (const p of products) {
			if (!p.productId) {
				return res.status(400).json({ message: 'ProductId is required for each product' })
			}
			if (!p.quantity || p.quantity <= 0) {
				return res.status(400).json({ message: 'Quantity is required and must be > 0 for each product' })
			}
			if (!p.unitType) {
				return res.status(400).json({ message: 'Unit type is required for each product' })
			}
		}
		if (dueDate && new Date(dueDate) < new Date()) {
			return res.status(400).json({ message: 'Due date cannot be in past' })
		}

		const client = await clientController.getClientById(clientId)
		if (!client) {
			return res.status(404).json({ message: 'Client not found' })
		}
		logger.info('client fetched from DB')

		const order = await orderController.createNewOrder(
			client,
			products,
			dueDate
		)
		if (!order) {
			return res.status(500).json({ message: 'Error in creating order' })
		}

		logger.info('order created successfully')
		res.status(201).json({
			message: 'Order created successfully',
			orderId: order._id,
		})
	} catch (error) {
		logger.error(`Error in creating order: ${error.message}`)
		res.status(500).json({ message: 'Internal server error' })
	}
})

/**
 * @GET
 * @desc Get all orders
 * @access Admin
 */
router.get(
	'/all',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to get all orders')
			
			// Get pagination parameters from query string
			const page = parseInt(req.query.page) || 1;
			const limit = parseInt(req.query.limit) || 10;
			
			// Validate pagination parameters
			if (page < 1) {
				return res.status(400).json({ message: 'Page number must be greater than 0' });
			}
			if (limit < 1 || limit > 100) {
				return res.status(400).json({ message: 'Limit must be between 1 and 100' });
			}
			
			const result = await orderController.getAllOrders(page, limit);
			if (!result || !result.orders) {
				return res.status(404).json({ message: 'No orders found' })
			}
			logger.info('orders fetched successfully')
			res.status(200).json({
				message: 'Orders fetched successfully',
				orders: result.orders,
				pagination: result.pagination
			})
		} catch (error) {
			logger.error(`Error in fetching orders: ${error.message}`)
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @GET
 * @desc Get order by id
 * @access Admin
 */
router.get(
	'/:orderId',
	authenticate,
	authorize(rolesEnum.ADMIN),
	async (req, res) => {
		try {
			logger.info(`request received to get order by id: ${req.params.orderId}`)
			const order = await orderController.getOrderById(req.params.orderId)
			if (!order) {
				return res.status(404).json({ message: 'Order not found' })
			}
			logger.info('order fetched successfully')
			res.status(200).json({
				message: 'Order fetched successfully',
				order,
			})
		} catch (error) {
			logger.error(`Error in fetching order: ${error.message}`)
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)
/**
 * @DELETE
 * @desc Delete order by id
 * @access Admin
 */
router.delete(
	'/:orderId',
	authenticate,
	authorize(rolesEnum.ADMIN),
	async (req, res) => {
		try {
			logger.info(
				`request received to delete order by id: ${req.params.orderId}`
			)
			const order = await orderController.deleteOrderById(req.params.orderId)
			if (!order) {
				return res.status(404).json({ message: 'Order not found' })
			}
			logger.info('order deleted successfully')
			res.status(200).json({
				message: 'Order deleted successfully',
				order,
			})
		} catch (error) {
			logger.error(`Error in deleting order: ${error.message}`)
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @PATCH
 * @desc Update status by id
 * @access Admin
 */

router.patch(
  '/:id/status',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const orderId = req.params.id;
      const { status } = req.body;

      const validStatuses = ['PENDING', 'COMPLETED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const updatedOrder = await orderController.updateOrderStatus(orderId, status);

      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.status(200).json({
        message: 'Order status updated successfully',
        order: updatedOrder
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

/**
 * @GET
 * @desc Generate invoice PDF by order ID
 * @access Admin
 */
router.get(
	'/:orderId/invoice',
	authenticate,
	authorize(rolesEnum.ADMIN),
	async (req, res) => {
		try {
			const { orderId } = req.params;

			const order = await orderController.getOrderById(orderId);
			// .populate('clientId')
			// .populate('productId');

			if (!order) {
				return res.status(404).json({ message: 'Order not found' });
			}
			const client = await clientController.getClientById(order.clientId);
			const product = await productController.getProductById(order.productId);
			const pdfBuffer = await generateInvoicePDF({ order, client, product });
			
			res.set({
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename=invoice_${order.orderNo}.pdf`,
			});

			return res.send(pdfBuffer);
		} catch (error) {
			console.error('Invoice generation error:', error);
			res.status(500).json({ message: 'Failed to generate invoice' });
		}
	}
);

// Get dashboard statistics
router.get('/dashboard/stats', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		const stats = await orderController.getDashboardStats();
		res.json({
			success: true,
			stats: stats.stats,
			recentOrders: stats.recentOrders
		});
	} catch (error) {
		console.error('Dashboard stats error:', error);
		res.status(500).json({ 
			success: false, 
			message: 'Failed to fetch dashboard statistics' 
		});
	}
});

module.exports = router
