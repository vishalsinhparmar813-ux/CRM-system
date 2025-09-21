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
const generateInvoicePDF = require('../utils/pdfGenerator');
const SubOrder =  require('../models/subOrder');
const Product = require('../models/product');

const { v4: uuidv4 } = require('uuid');

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
 * @desc Create dispatch for an order (multiple products) and return Dispatch PDF
 * @access Admin and sub-admin
 */
router.post(
  '/dispatch',
  authenticate,
  authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN),
  async (req, res) => {
    try {
      const {
        orderNo,
        orderId,
        clientId,
        lines,
        vehicleNo,
        type,
        destination,
        consigneeName,
        consigneeAddress,
        consigneeContact,
        consigneeGstin,
        consigneeState,
        buyerName,
        buyerAddress,
        buyerContact,
        buyerGstin,
        buyerState,
        // Dispatch date from frontend date picker
        dispatchDate,
        // GST enabled flag from frontend
        gstEnabled
      } = req.body;

      // ----------------------------
      // ✅ Basic validation
      // ----------------------------
      if (!orderNo || !orderId || !clientId) {
        return res.status(400).json({ message: 'orderNo, orderId and clientId are required' });
      }
      if (!Array.isArray(lines) || lines.length === 0) {
        return res.status(400).json({ message: 'At least one dispatch line is required' });
      }

      // ----------------------------
      // ✅ Get Client + Order
      // ----------------------------
      const client = await clientController.getClientById(clientId);
      if (!client) return res.status(404).json({ message: 'Client not found' });

      const order = await orderController.getOrderByOrderNo(orderNo);
      if (!order) return res.status(404).json({ message: 'Order not found' });

      if (order._id.toString() !== orderId.toString() || order.clientId.toString() !== clientId.toString()) {
        return res.status(400).json({ message: 'Order mismatch for provided client/order' });
      }

      // ----------------------------
      // ✅ Deduct dispatched qty but DON'T reduce remaining amount
      // Remaining amount should only be reduced by payments, not dispatches
      // ----------------------------
      let totalDispatchedValue = 0; // Track value of dispatched items for status calculation

      order.products = order.products.map(p => {
        const line = lines.find(l => l.productId.toString() === p.productId.toString());
        if (line) {
          const dispatchedQty = Number(line.quantity || 0);
          const currentRemaining = p.remainingQuantity ?? p.quantity;
          p.remainingQuantity = Math.max(0, currentRemaining - dispatchedQty);
          
          // Calculate dispatched value for status tracking only
          const rate = p.ratePrice || (p.amount / p.quantity);
          totalDispatchedValue += dispatchedQty * rate;
        }

        // DON'T modify p.remainingAmount here - it should only change with payments
        return p;
      });

      // DON'T modify order.remainingAmount here - it represents payment remaining, not dispatch remaining

      // ✅ Update status based on dispatch progress, not payment progress
      const totalOrderValue = order.totalAmount;
      const totalDispatchedSoFar = totalOrderValue - order.products.reduce((sum, p) => {
        const rate = p.ratePrice || (p.amount / p.quantity);
        return sum + ((p.remainingQuantity || 0) * rate);
      }, 0);

      if (totalDispatchedSoFar >= totalOrderValue) {
        order.status = "COMPLETED";
      } else if (totalDispatchedSoFar > 0) {
        order.status = "PARTIALLY_DISPATCHED";
      } else {
        order.status = "PENDING";
      }

      await order.save();

      // ----------------------------
      // ✅ Prepare dispatched products for PDF
      // ----------------------------
      const orderProducts = await orderController.getOrderProductsByOrderNo(orderNo);
      const productMap = {};
      for (const p of orderProducts) productMap[p.productId] = p;

      const dispatchedProducts = lines
        .filter(l => Number(l.quantity) > 0)
        .map(l => ({
          name: productMap[l.productId]?.productName || l.productId,
          productId: l.productId,
          quantity: Number(l.quantity),
          unitType: productMap[l.productId]?.unitType || l.unitType,
          ratePrice: productMap[l.productId]?.ratePrice || 0,
          numberOfItems: productMap[l.productId]?.numberOfItems || 1,
          amount: (productMap[l.productId]?.ratePrice || 0) * Number(l.quantity)
        }));

      // ----------------------------
      // ✅ Dispatch Info object
      // ----------------------------
      const dispatchInfo = {
        type,
        address: destination,
        vehicleNo,
        date: dispatchDate,
        consignee: { consigneeName, consigneeAddress, consigneeContact, consigneeGstin, consigneeState },
        buyer: { buyerName, buyerAddress, buyerContact, buyerGstin, buyerState }
      };

      // ----------------------------
      // ✅ Generate PDF using order's GST field
      // ----------------------------
      const pdfBuffer = await generateInvoicePDF.generateDispatchPDF({
        order: order,
        client,
        dispatchInfo,
        dispatchedProducts,
        gstEnabled
      });

      // ----------------------------
      // ✅ Save Dispatch Invoice Record
      // ----------------------------
      console.log('=== DEBUG: Creating dispatch invoice record ===');
      console.log('Order data:', { orderNo, orderId, clientId });
      
      const dispatchInvoice = new SubOrder({
        _id: uuidv4(),
        orderNo: orderNo,
        orderId: orderId,
        clientId: clientId,
        isDispatchInvoice: true,
        dispatchDate: new Date(dispatchDate || Date.now()),
        dispatchInfo: {
          type,
          destination,
          vehicleNo,
          consigneeName,
          consigneeAddress,
          consigneeContact,
          consigneeGstin,
          consigneeState,
          buyerName,
          buyerAddress,
          buyerContact,
          buyerGstin,
          buyerState
        },
        dispatchedProducts: dispatchedProducts,
        totalAmount: dispatchedProducts.reduce((sum, p) => sum + (p.amount || 0), 0)
      });

      console.log('Saving dispatch invoice with ID:', dispatchInvoice._id);
      await dispatchInvoice.save();
      console.log('Dispatch invoice saved successfully');

      // ----------------------------
      // ✅ Send updated order + PDF
      // ----------------------------
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=dispatch_${orderNo}.pdf`);

      return res.send(pdfBuffer);

    } catch (error) {
      logger.error(`Error creating dispatch: ${error.message}`);
      return res.status(500).json({ message: 'Failed to create dispatch' });
    }
  }
);

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

// Get clients with dispatch invoices - MUST be before /:id route
router.get('/clients-with-invoices', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
    try {
        console.log('clients-with-invoices endpoint called');
        logger.info('Fetching clients with dispatch invoices');
        
        // Check for dispatch invoice records
        const invoiceCount = await SubOrder.countDocuments({
            isDispatchInvoice: true,
            totalAmount: { $exists: true, $gt: 0 }
        });
        console.log(`SubOrders with dispatch invoice data: ${invoiceCount}`);
        
        if (invoiceCount === 0) {
            return res.json({
                success: true,
                clients: [],
                message: 'No dispatch invoice records found'
            });
        }
        
        // Aggregation pipeline to group dispatch invoices by client
        const clientsWithInvoices = await SubOrder.aggregate([
            {
                $match: {
                    isDispatchInvoice: true,
                    totalAmount: { $exists: true, $gt: 0 }
                }
            },
            {
                $group: {
                    _id: "$clientId",
                    totalInvoices: { $sum: 1 },
                    totalAmount: { $sum: "$totalAmount" },
                    latestDispatchDate: { $max: "$dispatchDate" },
                    invoices: {
                        $push: {
                            invoiceId: "$_id",
                            orderId: "$orderId",
                            orderNo: "$orderNo",
                            amount: "$totalAmount",
                            dispatchDate: "$dispatchDate",
                            destination: { $ifNull: ["$dispatchInfo.destination", "N/A"] }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "clients",
                    localField: "_id", 
                    foreignField: "_id",
                    as: "clientInfo"
                }
            },
            {
                $unwind: {
                    path: "$clientInfo",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $project: {
                    _id: 1,
                    name: "$clientInfo.name",
                    email: "$clientInfo.email", 
                    mobile: "$clientInfo.mobile",
                    totalInvoices: 1,
                    totalAmount: 1,
                    latestDispatchDate: 1,
                    invoices: 1
                }
            },
            {
                $sort: { latestDispatchDate: -1 }
            }
        ]);

        console.log(`Found ${clientsWithInvoices.length} clients with dispatch invoices`);

        res.json({
            success: true,
            clients: clientsWithInvoices
        });

    } catch (error) {
        console.error('Error in clients-with-invoices endpoint:', error);
        logger.error(`Error fetching clients with invoices: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

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

// Get dispatch invoices by order ID
router.get('/invoices/:orderId', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
	try {
		const { orderId } = req.params;
		
		if (!orderId) {
			return res.status(400).json({ message: 'Order ID is required' });
		}

		// Find all dispatch invoices for this order
		const invoices = await SubOrder.find({ 
			orderId: orderId,
			isDispatchInvoice: true 
		})
		.populate('clientId', 'name email mobile')
		.sort({ dispatchDate: -1, createdAt: -1 })
		.lean();

		// Populate product names for each invoice's dispatched products
		if (invoices && invoices.length > 0) {
			const Product = require('../models/product');
			
			for (let invoice of invoices) {
				if (invoice.dispatchedProducts && invoice.dispatchedProducts.length > 0) {
					for (let product of invoice.dispatchedProducts) {
						try {
							const productDetails = await Product.findById(product.productId).lean();
							if (productDetails) {
								product.productName = productDetails.name;
								product.productAlias = productDetails.alias;
							} else {
								product.productName = `Product ${product.productId}`;
							}
						} catch (err) {
							console.warn(`Failed to fetch product details for ${product.productId}: ${err.message}`);
							product.productName = `Product ${product.productId}`;
						}
					}
				}
			}
		}

		res.status(200).json({
			success: true,
			invoices: invoices || [],
			message: invoices?.length ? 'Dispatch invoices fetched successfully' : 'No dispatch invoices found for this order'
		});
	} catch (error) {
		console.error('Error fetching dispatch invoices:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// Get dispatch invoice PDF by ID
router.get('/invoices/:invoiceId/pdf', authenticate, authorize(rolesEnum.ADMIN, rolesEnum.SUB_ADMIN), async (req, res) => {
	try {
		const { invoiceId } = req.params;
		
		console.log('=== DEBUG: Fetching PDF for invoice ID:', invoiceId);
		
		if (!invoiceId) {
			return res.status(400).json({ message: 'Invoice ID is required' });
		}

		// Find dispatch invoice by ID
		const invoice = await SubOrder.findOne({ 
			_id: invoiceId,
			isDispatchInvoice: true 
		}).lean();

		console.log('Found invoice:', invoice ? 'Yes' : 'No');

		if (!invoice) {
			return res.status(404).json({ message: 'Dispatch invoice not found' });
		}

		// Get full client and order data for PDF generation
		const client = await clientController.getClientById(invoice.clientId);
		const order = await orderController.getOrderById(invoice.orderId);
		
		// Populate product names in order products for PDF generation
		if (order && order.products && order.products.length > 0) {
			// const Product = require('../models/product');
			for (let product of order.products) {
				try {
					const productDetails = await Product.findById(product.productId).lean();
					if (productDetails) {
						product.productName = productDetails.name;
						product.productAlias = productDetails.alias;
					}
				} catch (err) {
					console.warn(`Failed to fetch product details for ${product.productId}: ${err.message}`);
					product.productName = `Product ${product.productId}`;
				}
			}
		}

		if (!client || !order) {
			return res.status(404).json({ message: 'Client or order data not found' });
		}

		console.log('Generating PDF for invoice:', invoice._id);

		// Generate PDF with proper dispatch date and address structure
		const dispatchInfoWithDate = {
			...invoice.dispatchInfo,
			date: invoice.dispatchDate || invoice.dispatchInfo.date, // Use saved dispatch date
			// Restructure addresses for PDF generator
			consignee: {
				consigneeName: invoice.dispatchInfo.consigneeName,
				consigneeAddress: invoice.dispatchInfo.consigneeAddress,
				consigneeContact: invoice.dispatchInfo.consigneeContact,
				consigneeState: invoice.dispatchInfo.consigneeState
			},
			buyer: {
				buyerName: invoice.dispatchInfo.buyerName,
				buyerAddress: invoice.dispatchInfo.buyerAddress,
				buyerContact: invoice.dispatchInfo.buyerContact,
				buyerState: invoice.dispatchInfo.buyerState
			},
			// Map destination and vehicleNo for PDF
			address: invoice.dispatchInfo.destination,
			vehicleNo: invoice.dispatchInfo.vehicleNo
		};

		console.log('Using dispatch date for PDF:', dispatchInfoWithDate.date);
		console.log('Dispatch info structure:', JSON.stringify(dispatchInfoWithDate, null, 2));
		
		// Debug: Check dispatchedProducts data
		console.log('=== DEBUG: Dispatched Products Data ===');
		console.log('Number of products:', invoice.dispatchedProducts?.length || 0);
		if (invoice.dispatchedProducts && invoice.dispatchedProducts.length > 0) {
			invoice.dispatchedProducts.forEach((product, index) => {
				console.log(`Product ${index + 1}:`, {
					name: product.name || product.productName,
					quantity: product.quantity,
					numberOfItems: product.numberOfItems,
					unitType: product.unitType,
					ratePrice: product.ratePrice
				});
			});
		}

		const pdfBuffer = await generateInvoicePDF.generateDispatchPDF({
			order: order,
			client: client,
			dispatchInfo: dispatchInfoWithDate,
			dispatchedProducts: invoice.dispatchedProducts
		});

		// Send PDF
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', `inline; filename=dispatch_${invoice.orderNo}.pdf`);

		return res.send(pdfBuffer);
	} catch (error) {
		console.error('Error fetching dispatch invoice PDF:', error);
		res.status(500).json({ message: 'Internal server error', error: error.message });
	}
});

// Manual trigger to check and update order completion
router.post('/check-order-completion/:orderId', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info(`Manual order completion check requested for order: ${req.params.orderId}`);
        const { orderId } = req.params;
        const { checkAndMarkOrderAsCompleted } = require('../controllers/subOrderController');
        
        const wasCompleted = await checkAndMarkOrderAsCompleted(orderId);
        
        if (wasCompleted) {
            logger.info(`Order ${orderId} successfully marked as COMPLETED`);
            res.json({ 
                success: true, 
                message: 'Order marked as COMPLETED',
                orderId 
            });
        } else {
            logger.info(`Order ${orderId} does not meet completion criteria`);
            res.json({ 
                success: false, 
                message: 'Order does not meet completion criteria',
                orderId 
            });
        }
    } catch (error) {
        logger.error(`Error checking order completion: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check order completion',
            error: error.message 
        });
    }
});

// Check all pending orders for completion
router.post('/check-all-orders-completion', authenticate, authorize(rolesEnum.ADMIN), async (req, res) => {
    try {
        logger.info('Manual bulk order completion check requested');
        const { checkAndUpdateAllOrdersCompletion } = require('../controllers/subOrderController');
        
        const results = await checkAndUpdateAllOrdersCompletion();
        
        res.json({
            success: true,
            message: `Checked ${results.totalOrders} orders. ${results.completedOrders.length} marked as completed.`,
            results
        });
        
    } catch (error) {
        logger.error(`Error checking all orders completion: ${error.message}`);
        logger.error(`Error stack: ${error.stack}`);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to check orders completion',
            error: error.message 
        });
    }
});

module.exports = router