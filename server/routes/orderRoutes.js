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
const Product = require('../models/product');
const Order = require('../models/order');
const transactionController = require('../controllers/transactionController');
const { default: mongoose } = require('mongoose')

/**
 * @POST
 * @desc Create a new order
 * @access Admin
 */
router.post('/', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
	try {
		logger.info('request received to create a new order')
		const { clientId, products, dueDate, orderDate, cashPrice, gst } = req.body;
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
			if (!p.ratePrice || p.ratePrice <= 0) {
				return res.status(400).json({ message: 'Rate price is required and must be > 0 for each product' })
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
			dueDate,
			orderDate,
			gst,
		)
		if (!order) {
			return res.status(500).json({ message: 'Error in creating order' })
		}

		logger.info('order created successfully')
		res.status(201).json({
			success: true,
			message: 'Order created successfully',
			orderId: order._id,
			orderNo: order.orderNo
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
				success: true,
				message: 'Orders fetched successfully',
				data: result.orders,
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
 * @desc Get all orders with transactions included
 * @access Admin
 */
router.get(
	'/all-with-transactions',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to get all orders with transactions')
			
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
			
			const result = await orderController.getAllOrdersWithTransactions(page, limit);
			if (!result || !result.orders) {
				return res.status(404).json({ message: 'No orders found' })
			}
			logger.info('orders with transactions fetched successfully')
			res.status(200).json({
				message: 'Orders with transactions fetched successfully',
				orders: result.orders,
				pagination: result.pagination
			})
		} catch (error) {
			logger.error(`Error in fetching orders with transactions: ${error.message}`)
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @GET
 * @desc Get all orders grouped by client
 * @access Admin
 */
router.get(
	'/grouped-by-client',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to get orders grouped by client')
			
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
			
			const result = await orderController.getOrdersGroupedByClient(page, limit);
			if (!result || !result.clients) {
				return res.status(404).json({ message: 'No clients with orders found' })
			}
			logger.info('orders grouped by client fetched successfully')
			res.status(200).json({
				message: 'Orders grouped by client fetched successfully',
				clients: result.clients,
				pagination: result.pagination
			})
		} catch (error) {
			logger.error(`Error in fetching orders grouped by client: ${error.message}`)
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
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info(`request received to get order by id: ${req.params.orderId}`)
			const order = await orderController.getOrderById(req.params.orderId)
			if (!order) {
				return res.status(404).json({ message: 'Order not found' })
			}
			logger.info('order fetched successfully')
			res.status(200).json({
				success: true,
				message: 'Order fetched successfully',
				data: order,
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
 * @desc Update order by id (production-ready)
 * @access Admin
 */
router.patch(
  '/:orderId',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      logger.info(`request received to update order by id: ${req.params.orderId}`)
      const orderId = req.params.orderId;
      const updateData = req.body;

      // Use the production-ready controller method
      const updatedOrder = await orderController.updateOrderById(orderId, updateData);

      logger.info('order updated successfully');
      res.status(200).json({
        success: true,
        message: 'Order updated successfully',
        data: updatedOrder
      });
    } catch (error) {
      logger.error(`Error in updating order: ${error.message}`);
      
      // Handle specific error types
      if (error.message.includes('not found')) {
        return res.status(404).json({ 
          success: false,
          message: error.message 
        });
      } else if (error.message.includes('required') || error.message.includes('must be')) {
        return res.status(400).json({ 
          success: false,
          message: error.message 
        });
      } else {
        return res.status(500).json({ 
          success: false,
          message: 'Internal server error' 
        });
      }
    }
  }
);

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
 * @PATCH
 * @desc Close order by id (Admin only)
 * @access Admin
 */
router.patch(
  '/:id/close',
  authenticate,
  authorize(rolesEnum.ADMIN), // Only ADMIN can close orders
  async (req, res) => {
    try {
      const orderId = req.params.id;
      
      const updatedOrder = await orderController.closeOrder(orderId);

      if (!updatedOrder) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.status(200).json({
        message: 'Order closed successfully',
        order: updatedOrder
      });
    } catch (error) {
      logger.error(`Error in closing order: ${error.message}`);
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
			if (!order) {
				return res.status(404).json({ message: 'Order not found' });
			}

			const client = await clientController.getClientById(order.clientId);
			if (!client) {
				return res.status(404).json({ message: 'Client not found' });
			}

			// Get all products for this order
			let products = [];
			if (Array.isArray(order.products)) {
				products = await Promise.all(order.products.map(async (p) => {
					const prod = await Product.findById(p.productId);
					return {
						name: prod ? prod.name : p.productId,
						quantity: p.quantity,
						unitType: p.unitType,
						amount: p.amount,
						ratePrice: p.ratePrice,
					};
				}));
			}

			// Get all transactions for this order
			let transactions = [];
			if (Array.isArray(order.transactions)) {
				transactions = await Promise.all(order.transactions.map(async (txnId) => {
					const txn = await transactionController.getTransactionById(txnId);
					return txn;
				}));
				// Filter out null transactions and sort by date
				transactions = transactions.filter(txn => txn).sort((a, b) => new Date(a.date) - new Date(b.date));
			}

			const pdfBuffer = await generateInvoicePDF({ 
				order, 
				client, 
				products, 
				transactions 
			});
			
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

/**
 * @POST
 * @desc Generate client ledger PDF
 * @access Admin
 */
router.post(
	'/client/:clientId/ledger-pdf',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			const { clientId } = req.params;

			// Validate clientId - it's a UUID string, not ObjectId
			if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
				return res.status(400).json({ message: 'Invalid client ID provided' });
			}

			logger.info(`Request received to generate ledger PDF for client: ${clientId}`);

			// Generate the PDF using the controller
			const pdfBuffer = await orderController.generateClientLedgerPDFController(clientId);
			
			// Validate PDF buffer
			if (!pdfBuffer || pdfBuffer.length === 0) {
				logger.error('Generated PDF buffer is empty or invalid');
				return res.status(500).json({ message: 'PDF generation failed - empty buffer' });
			}

			// Set proper headers for PDF response
			res.set({
				'Content-Type': 'application/pdf',
				'Content-Length': pdfBuffer.length,
				'Content-Disposition': `attachment; filename=ledger_${clientId}_${new Date().toISOString().split('T')[0]}.pdf`,
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
			});

			logger.info('Client ledger PDF generated successfully');
			return res.end(pdfBuffer);
		} catch (error) {
			logger.error(`Error generating client ledger PDF: ${error.message}`);
			
			// Send appropriate error response
			if (error.message.includes('not found')) {
				return res.status(404).json({ message: error.message });
			} else if (error.message.includes('Invalid') || error.message.includes('No orders')) {
				return res.status(400).json({ message: error.message });
			} else {
				return res.status(500).json({ message: 'Internal server error while generating PDF' });
			}
		}
	}
);

/**
 * @POST
 * @desc Generate order receipt PDF for single or multiple orders
 * @access Admin
 */
router.post(
	'/receipt-pdf',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			const { orderIds, clientId } = req.body;

			// Validate input
			if (!orderIds || (!Array.isArray(orderIds) && typeof orderIds !== 'string')) {
				return res.status(400).json({ message: 'Order IDs are required' });
			}

			if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
				return res.status(400).json({ message: 'Invalid client ID provided' });
			}

			logger.info(`Request received to generate order receipt PDF for orders: ${orderIds}, client: ${clientId}`);

			// Generate the PDF using the controller
			const pdfBuffer = await orderController.generateOrderReceiptPDFController(orderIds, clientId);
			
			// Validate PDF buffer
			if (!pdfBuffer || pdfBuffer.length === 0) {
				logger.error('Generated PDF buffer is empty or invalid');
				return res.status(500).json({ message: 'PDF generation failed - empty buffer' });
			}

			// Set proper headers for PDF response
			const orderIdStr = Array.isArray(orderIds) ? orderIds.join('-') : orderIds;
			res.set({
				'Content-Type': 'application/pdf',
				'Content-Length': pdfBuffer.length,
				'Content-Disposition': `attachment; filename=order_receipt_${orderIdStr}_${new Date().toISOString().split('T')[0]}.pdf`,
				'Cache-Control': 'no-cache, no-store, must-revalidate',
				'Pragma': 'no-cache',
				'Expires': '0',
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization'
			});

			logger.info('Order receipt PDF generated successfully');
			return res.end(pdfBuffer);
		} catch (error) {
			logger.error(`Error generating order receipt PDF: ${error.message}`);
			
			// Send appropriate error response
			if (error.message.includes('not found')) {
				return res.status(404).json({ message: error.message });
			} else if (error.message.includes('Invalid') || error.message.includes('required')) {
				return res.status(400).json({ message: error.message });
			} else {
				return res.status(500).json({ message: 'Internal server error while generating PDF' });
			}
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

/**
 * @GET
 * @desc Get orders by client ID
 * @access Admin
 */
router.get(
	'/client/:clientId',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to get orders by client id')
			const { clientId } = req.params
			const { page = 1, limit = 10 } = req.query

			if (!clientId) {
				return res.status(400).json({ message: 'Client ID is required' })
			}

			const orders = await orderController.getOrdersByClientId(clientId, page, limit)
			
			res.status(200).json({
				success: true,
				orders: orders || [],
				message: orders?.length ? 'Orders fetched successfully' : 'No orders found for this client'
			})
		} catch (error) {
			logger.error(`Error in getting orders by client: ${error.message}`)
			if (error.statusCode) {
				return res.status(error.statusCode).json({ message: error.message })
			}
			res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @GET
 * @desc Get order by order number
 * @access Admin and sub-admin
 */
router.get(
	'/by-number/:orderNumber',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			const { orderNumber } = req.params;
			logger.info(`Request received to get order by number: ${orderNumber}`);

			if (!orderNumber) {
				return res.status(400).json({ message: 'Order number is required' });
			}

			// Find order by orderNo field
			const order = await Order.findOne({ orderNo: parseInt(orderNumber) })
				.populate({
					path: 'clientId',
					select: 'name email mobile alias',
					options: { lean: true }
				})
				.lean();

			if (!order) {
				return res.status(404).json({ message: 'Order not found' });
			}

			logger.info(`Order found: ${order.orderNo}`);
			res.status(200).json({
				success: true,
				data: order
			});

		} catch (error) {
			logger.error(`Error getting order by number: ${error.message}`);
			if (error.statusCode) {
				return res.status(error.statusCode).json({ message: error.message });
			}
			res.status(500).json({ message: 'Internal server error' });
		}
	}
)

/**
 * @GET
 * @desc Search orders by query with pagination and better performance
 * @access Admin and sub-admin
 */
router.get(
	'/search',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			const { q, page = 1, limit = 20 } = req.query;
			logger.info(`Request received to search orders with query: ${q}`);

			// Input validation
			if (!q || q.trim().length === 0) {
				return res.status(400).json({ 
					success: false,
					message: 'Search query is required' 
				});
			}

			// Sanitize input
			const sanitizedQuery = q.trim();
			if (sanitizedQuery.length > 100) {
				return res.status(400).json({ 
					success: false,
					message: 'Search query too long' 
				});
			}

			// Pagination validation
			const pageNum = Math.max(1, parseInt(page));
			const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50 results per page
			const skip = (pageNum - 1) * limitNum;

			// Build search query with better indexing
			const searchConditions = [];

			// Exact order number match (highest priority)
			if (!isNaN(sanitizedQuery)) {
				searchConditions.push({ orderNo: parseInt(sanitizedQuery) });
			}

			// Partial order number match
			if (/^\d+$/.test(sanitizedQuery)) {
				searchConditions.push({ 
					orderNo: { 
						$gte: parseInt(sanitizedQuery), 
						$lt: parseInt(sanitizedQuery + '9'.repeat(10 - sanitizedQuery.length)) 
					} 
				});
			}

			// Text search for order number as string
			searchConditions.push({ 
				orderNo: { $regex: sanitizedQuery.replace(/[#]/g, ''), $options: 'i' } 
			});

			const searchQuery = { $or: searchConditions };

			// Execute search with proper indexing
			const [orders, totalCount] = await Promise.all([
				Order.find(searchQuery)
				.populate({
					path: 'clientId',
					select: 'name email mobile alias',
					options: { lean: true }
				})
				.select('orderNo clientId status totalAmount remainingAmount createdAt orderDate')
				.sort({ orderNo: -1, createdAt: -1 })
				.skip(skip)
				.limit(limitNum)
				.lean(),
				Order.countDocuments(searchQuery)
			]);

			// Enhanced response with metadata
			const enhancedOrders = orders.map(order => ({
				...order,
				clientName: order.clientId?.name || 'Unknown Client',
				clientAlias: order.clientId?.alias || null,
				canDispatch: ['PENDING', 'PARTIALLY_DISPATCHED'].includes(order.status),
				isOverdue: order.orderDate && new Date(order.orderDate) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
			}));

			logger.info(`Found ${orders.length}/${totalCount} orders matching query "${sanitizedQuery}"`);
			
			res.status(200).json({
				success: true,
				data: enhancedOrders,
				pagination: {
					currentPage: pageNum,
					totalPages: Math.ceil(totalCount / limitNum),
					totalResults: totalCount,
					hasMore: skip + orders.length < totalCount
				},
				query: sanitizedQuery
			});

		} catch (error) {
			logger.error(`Error searching orders: ${error.message}`);
			logger.error(`Error stack: ${error.stack}`);
			res.status(500).json({ 
				success: false,
				message: 'Internal server error',
				error: process.env.NODE_ENV === 'development' ? error.message : undefined
			});
		}
	}
)

module.exports = router
