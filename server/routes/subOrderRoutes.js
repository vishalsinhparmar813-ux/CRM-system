// routes/suborders.js
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
const subOrderController = require('../controllers/subOrderController')

/**
 * @POST
 * @desc Create a new sub-order
 * @access Admin and sub-admin
 */

router.post(
	'/',
	authenticate,
	authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
	async (req, res) => {
		try {
			logger.info('request received to create a new sub-order')

			const { orderNo, orderId, clientId, subOrders } = req.body;
			if (!orderNo) {
				return res.status(400).json({ message: 'Order number is required' })
			}
			if (!clientId) {
				return res.status(400).json({ message: 'Client ID is required' })
			}
			if (!Array.isArray(subOrders) || subOrders.length === 0) {
				return res.status(400).json({ message: 'At least one sub-order line is required' })
			}

			const client = await clientController.getClientById(clientId)
			if (!client) {
				return res.status(404).json({ message: 'Client not found' })
			}

			const order = await orderController.getOrderByOrderNo(orderNo)
			if (!order) {
				return res.status(404).json({ message: 'Order not found' })
			}
			if (order.clientId !== clientId) {
				return res.status(400).json({ message: 'Order number is not associated with this client' })
			}

			// Fetch products array for the order
			const orderProducts = await orderController.getOrderProductsByOrderNo(orderNo);

			const results = [];
			for (const line of subOrders) {
				const { productId, quantity, unitType } = line;
				if (!productId) {
					results.push({ productId, success: false, message: 'ProductId is required' });
					continue;
				}
				if (!quantity || quantity <= 0) {
					results.push({ productId, success: false, message: 'Quantity is required and must be > 0' });
					continue;
				}
				if (!unitType) {
					results.push({ productId, success: false, message: 'Unit type is required' });
					continue;
				}
				const product = await productController.getProductById(productId);
				if (!product) {
					results.push({ productId, success: false, message: 'Product not found' });
					continue;
				}
				// Find the product in the order
				const orderProduct = orderProducts.find(p => p.productId === productId);
				if (!orderProduct) {
					results.push({ productId, success: false, message: 'Product is not associated with this order' });
					continue;
				}
				if (orderProduct.unitType !== unitType) {
					results.push({ productId, success: false, message: 'Invalid unit type for this product/order' });
					continue;
				}
				if (orderProduct.quantity < quantity) {
					results.push({ productId, success: false, message: 'Quantity exceeds remaining for this product' });
					continue;
				}
				try {
					const subOrder = await subOrderController.createNewSubOrder(
						orderNo,
						order._id,
						client,
						product,
						quantity,
						unitType
					);
					results.push({ productId, success: true, subOrderId: subOrder._id });
				} catch (err) {
					results.push({ productId, success: false, message: err.message });
				}
			}
			logger.info('sub-orders processed');
			res.status(201).json({
				message: 'Sub-orders processed',
				results
			});
		} catch (error) {
			logger.error(`Error creating sub-orders: ${error.message}`)
			if (error.statusCode) {
				return res.status(error.statusCode).json({ message: error.message })
			}
			return res.status(500).json({ message: 'Internal server error' })
		}
	}
)

/**
 * @POST
 * @desc Create multiple sub-orders atomically (ACID transaction)
 * @access Admin and sub-admin
 */
router.post(
  '/atomic',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      logger.info('request received to create multiple sub-orders atomically');
      const { orderNo, orderId, clientId, subOrders } = req.body;
      if (!orderNo) {
        return res.status(400).json({ message: 'Order number is required' })
      }
      if (!clientId) {
        return res.status(400).json({ message: 'Client ID is required' })
      }
      if (!Array.isArray(subOrders) || subOrders.length === 0) {
        return res.status(400).json({ message: 'At least one sub-order line is required' })
      }
      const client = await clientController.getClientById(clientId)
      if (!client) {
        return res.status(404).json({ message: 'Client not found' })
      }
      const order = await orderController.getOrderByOrderNo(orderNo)
      if (!order) {
        return res.status(404).json({ message: 'Order not found' })
      }
      if (order.clientId !== clientId) {
        return res.status(400).json({ message: 'Order number is not associated with this client' })
      }
      try {
        const result = await subOrderController.createMultipleSubOrdersAtomic(
          orderNo,
          order._id,
          client,
          subOrders
        );
        logger.info('atomic sub-orders processed');
        res.status(201).json({
          message: 'Atomic sub-orders processed',
          results: result.subOrders.map(so => ({
            productId: so.productId,
            success: true,
            subOrderId: so._id
          }))
        });
      } catch (error) {
        logger.error(`Error creating atomic sub-orders: ${error.message}`);
        return res.status(500).json({ message: error.message });
      }
    } catch (error) {
      logger.error(`Error in atomic sub-orders route: ${error.message}`);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message })
      }
      return res.status(500).json({ message: 'Internal server error' })
    }
  }
);

/**
 * @GET
 * @desc Get a suborder by ID
 * @access Admin and sub admin
 */
router.get(
  '/all',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const subOrders = await subOrderController.getAllSubOrders();
      res.status(200).json({ subOrders });
    } catch (error) {
      logger.error(`Error fetching all sub-orders: ${error.message}`);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
);

router.get(
  '/:id',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const subOrderId = req.params.id;
      logger.info(`Request received to fetch sub-order ${subOrderId}`);

      const subOrder = await subOrderController.getSubOrderById(subOrderId);
      if (!subOrder) {
        return res.status(404).json({ message: 'Sub-order not found' });
      }

      const [client, product] = await Promise.all([
        clientController.getClientById(subOrder.clientId),
        productController.getProductById(subOrder.productId),
      ]);

      if (!client || !product) {
        return res.status(404).json({ message: 'Client or Product not found' });
      }

      res.status(200).json({
        subOrderId: subOrder._id,
        quantity: subOrder.quantity,
		status: subOrder.status
      });
    } catch (error) {
      logger.error(`Error fetching sub-order details: ${error.message}`);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

/**
 * @PATCH
 * @desc Update sub-order status
 * @access Admin and sub-admin
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const subOrderId = req.params.id;
      const { status } = req.body;

      logger.info(`Request received to update status for sub-order ${subOrderId}`);

      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }

      // Optional: Validate status against possible values
      const validStatuses = ['PENDING', 'DISPATCHED', 'COMPLETED']; // Add your actual status values
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      const updatedSubOrder = await subOrderController.updateSubOrderStatus(
        subOrderId,
        status
      );
console.log("updatedSubOrder in api",updatedSubOrder)
      if (!updatedSubOrder) {
        return res.status(404).json({ message: 'Sub-order not found in status' });
      }

      logger.info(`Sub-order status updated successfully for ${subOrderId}`);
      res.status(200).json({
        message: 'Sub-order status updated successfully',
        subOrder: updatedSubOrder
      });
    } catch (error) {
      logger.error(`Error updating sub-order status: ${error.message}`);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);

/**
 * @PATCH
 * @desc Bulk update sub-order statuses
 * @access Admin and sub-admin
 */
router.patch(
  '/bulk/status',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const { subOrderIds, status } = req.body;

      logger.info(`Request received to bulk update status for ${subOrderIds?.length || 0} sub-orders`);
      logger.info(`Request body:`, req.body);
      logger.info(`Sub-order IDs:`, subOrderIds);
      logger.info(`Status:`, status);

      if (!subOrderIds || !Array.isArray(subOrderIds) || subOrderIds.length === 0) {
        logger.error('Invalid subOrderIds:', subOrderIds);
        return res.status(400).json({ message: 'Sub-order IDs array is required' });
      }

      if (!status) {
        logger.error('Missing status');
        return res.status(400).json({ message: 'Status is required' });
      }

      // Validate status against possible values
      const validStatuses = ['PENDING', 'DISPATCHED', 'COMPLETED'];
      if (!validStatuses.includes(status)) {
        logger.error('Invalid status:', status);
        return res.status(400).json({ message: 'Invalid status value' });
      }

      // Validate that all subOrderIds are valid
      if (!subOrderIds.every(id => typeof id === 'string' && id.trim().length > 0)) {
        logger.error('Invalid subOrderIds format:', subOrderIds);
        return res.status(400).json({ message: 'Invalid sub-order ID format' });
      }

      logger.info(`Calling bulkUpdateSubOrderStatus with ${subOrderIds.length} IDs and status ${status}`);
      const result = await subOrderController.bulkUpdateSubOrderStatus(
        subOrderIds,
        status
      );

      logger.info(`Bulk sub-order status update completed. Success: ${result.successCount}, Failed: ${result.failedCount}`);
      logger.info(`Result object:`, result);
      
      res.status(200).json({
        message: `Bulk status update completed. ${result.successCount} updated successfully, ${result.failedCount} failed.`,
        result: result
      });
    } catch (error) {
      logger.error(`Error in bulk updating sub-order status: ${error.message}`);
      logger.error(`Error stack:`, error.stack);
      if (error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
);


module.exports = router