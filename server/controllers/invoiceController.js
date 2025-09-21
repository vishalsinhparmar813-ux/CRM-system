const Order = require('../models/order');
const Client = require('../models/client');
const Product = require('../models/product');
const generateInvoicePDF = require('../utils/pdfGenerator');
const logger = require('../utils/logger');

/**
 * Get all dispatched orders (invoices)
 */
const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, clientId, startDate, endDate, minAmount, maxAmount, destination } = req.query;
    
    // Build filter for dispatched orders
    const filter = {
      status: { $in: ['PARTIALLY_DISPATCHED', 'COMPLETED'] }, // Orders that have been dispatched
      $expr: {
        $lt: ['$remainingAmount', '$totalAmount'] // Has some dispatch activity
      }
    };
    
    if (clientId) filter.clientId = clientId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (minAmount || maxAmount) {
      filter.totalAmount = {};
      if (minAmount) filter.totalAmount.$gte = parseFloat(minAmount);
      if (maxAmount) filter.totalAmount.$lte = parseFloat(maxAmount);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find(filter)
      .populate('clientId', 'name email mobile')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);
    
    // Transform orders to invoice format
    const invoices = orders.map(order => ({
      _id: order._id,
      invoiceNo: `DISP-${order.orderNo}`,
      orderNo: order.orderNo,
      orderId: order._id,
      clientId: order.clientId._id,
      clientName: order.clientId.name,
      clientEmail: order.clientId.email,
      clientMobile: order.clientId.mobile,
      dispatchDate: order.date,
      totalAmount: order.totalAmount,
      dispatchedAmount: order.totalAmount - (order.remainingAmount || 0),
      remainingAmount: order.remainingAmount || 0,
      status: order.status,
      products: order.products,
      destination: order.products?.[0]?.destination || 'N/A'
    }));

    res.json({
      success: true,
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error(`Error fetching invoices: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
};

/**
 * Get invoices for a specific client
 */
const getClientInvoices = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const filter = {
      clientId,
      status: { $in: ['PARTIALLY_DISPATCHED', 'COMPLETED'] },
      $expr: {
        $lt: ['$remainingAmount', '$totalAmount']
      }
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const orders = await Order.find(filter)
      .populate('clientId', 'name email mobile')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(filter);
    
    const invoices = orders.map(order => ({
      _id: order._id,
      invoiceNo: `DISP-${order.orderNo}`,
      orderNo: order.orderNo,
      orderId: order._id,
      clientId: order.clientId._id,
      clientName: order.clientId.name,
      dispatchDate: order.date,
      totalAmount: order.totalAmount,
      dispatchedAmount: order.totalAmount - (order.remainingAmount || 0),
      remainingAmount: order.remainingAmount || 0,
      status: order.status,
      products: order.products
    }));

    res.json({
      success: true,
      invoices,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    logger.error(`Error fetching client invoices: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch client invoices' });
  }
};

/**
 * Get invoices for a specific order
 */
const getOrderInvoices = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId)
      .populate('clientId', 'name email mobile');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if order has been dispatched
    if (!['PARTIALLY_DISPATCHED', 'COMPLETED'].includes(order.status) || 
        order.remainingAmount >= order.totalAmount) {
      return res.json({
        success: true,
        invoices: [],
        message: 'No dispatch invoices found for this order'
      });
    }

    const invoice = {
      _id: order._id,
      invoiceNo: `DISP-${order.orderNo}`,
      orderNo: order.orderNo,
      orderId: order._id,
      clientId: order.clientId._id,
      clientName: order.clientId.name,
      dispatchDate: order.date,
      totalAmount: order.totalAmount,
      dispatchedAmount: order.totalAmount - (order.remainingAmount || 0),
      remainingAmount: order.remainingAmount || 0,
      status: order.status,
      products: order.products
    };

    res.json({
      success: true,
      invoices: [invoice]
    });
  } catch (error) {
    logger.error(`Error fetching order invoices: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch order invoices' });
  }
};

/**
 * Get detailed invoice information
 */
const getInvoiceDetails = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const order = await Order.findById(invoiceId)
      .populate('clientId', 'name email mobile correspondenceAddress permanentAddr');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    const invoice = {
      _id: order._id,
      invoiceNo: `DISP-${order.orderNo}`,
      orderNo: order.orderNo,
      orderId: order._id,
      client: {
        _id: order.clientId._id,
        name: order.clientId.name,
        email: order.clientId.email,
        mobile: order.clientId.mobile,
        correspondenceAddress: order.clientId.correspondenceAddress,
        permanentAddr: order.clientId.permanentAddr
      },
      dispatchDate: order.date,
      totalAmount: order.totalAmount,
      dispatchedAmount: order.totalAmount - (order.remainingAmount || 0),
      remainingAmount: order.remainingAmount || 0,
      status: order.status,
      products: order.products.map(product => ({
        ...product,
        dispatchedQuantity: product.quantity - (product.remainingQuantity || 0),
        dispatchedAmount: product.amount - (product.remainingAmount || 0)
      }))
    };

    res.json({
      success: true,
      invoice
    });
  } catch (error) {
    logger.error(`Error fetching invoice details: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice details' });
  }
};

/**
 * Regenerate dispatch PDF for an order
 */
const regenerateInvoicePDF = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    
    const order = await Order.findById(invoiceId)
      .populate('clientId');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    // Check if order has been dispatched
    if (!['PARTIALLY_DISPATCHED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Order has not been dispatched yet' });
    }

    // Get dispatched products (products with reduced remaining quantity)
    const dispatchedProducts = order.products
      .filter(product => (product.remainingQuantity || 0) < product.quantity)
      .map(product => ({
        name: product.productName,
        productId: product.productId,
        quantity: product.quantity - (product.remainingQuantity || 0), // dispatched quantity
        unitType: product.unitType,
        ratePrice: product.ratePrice,
        numberOfItems: product.numberOfItems || 1,
        amount: (product.quantity - (product.remainingQuantity || 0)) * product.ratePrice
      }));

    if (dispatchedProducts.length === 0) {
      return res.status(400).json({ success: false, message: 'No dispatched products found' });
    }

    // Create default dispatch info for PDF regeneration
    const dispatchInfo = {
      type: "By Road",
      address: "As per order",
      vehicleNo: "N/A",
      date: order.date,
      consignee: { 
        consigneeName: order.clientId.name,
        consigneeAddress: order.clientId.correspondenceAddress ? 
          `${order.clientId.correspondenceAddress.area || ''}, ${order.clientId.correspondenceAddress.city || ''}`.trim() : 
          "As per records",
        consigneeContact: order.clientId.mobile || "",
        consigneeState: order.clientId.correspondenceAddress?.state || ""
      },
      buyer: { 
        buyerName: order.clientId.name,
        buyerAddress: order.clientId.permanentAddr ? 
          `${order.clientId.permanentAddr.area || ''}, ${order.clientId.permanentAddr.city || ''}`.trim() : 
          "As per records",
        buyerContact: order.clientId.mobile || "",
        buyerState: order.clientId.permanentAddr?.state || ""
      },
      gstEnabled: false // Default to no GST for regenerated PDFs
    };

    // Generate PDF using existing PDF generator
    const pdfBuffer = await generateInvoicePDF.generateDispatchPDF({
      order,
      client: order.clientId,
      dispatchInfo,
      dispatchedProducts
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=dispatch_${order.orderNo}.pdf`);
    
    return res.send(pdfBuffer);
  } catch (error) {
    logger.error(`Error regenerating invoice PDF: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to regenerate invoice PDF' });
  }
};

/**
 * Get invoice analytics
 */
const getInvoiceAnalytics = async (req, res) => {
  try {
    // Get all dispatched orders
    const dispatchedOrders = await Order.find({
      status: { $in: ['PARTIALLY_DISPATCHED', 'COMPLETED'] },
      $expr: {
        $lt: ['$remainingAmount', '$totalAmount']
      }
    }).populate('clientId', 'name');

    const totalInvoices = dispatchedOrders.length;
    const totalAmount = dispatchedOrders.reduce((sum, order) => 
      sum + (order.totalAmount - (order.remainingAmount || 0)), 0);

    // Monthly breakdown
    const monthlyData = {};
    dispatchedOrders.forEach(order => {
      const month = new Date(order.date).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { count: 0, amount: 0 };
      }
      monthlyData[month].count++;
      monthlyData[month].amount += order.totalAmount - (order.remainingAmount || 0);
    });

    // Top clients by dispatch amount
    const clientData = {};
    dispatchedOrders.forEach(order => {
      const clientName = order.clientId?.name || 'Unknown';
      if (!clientData[clientName]) {
        clientData[clientName] = { count: 0, amount: 0 };
      }
      clientData[clientName].count++;
      clientData[clientName].amount += order.totalAmount - (order.remainingAmount || 0);
    });

    const topClients = Object.entries(clientData)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    res.json({
      success: true,
      analytics: {
        summary: {
          totalInvoices,
          totalAmount,
          averageInvoiceAmount: totalInvoices > 0 ? totalAmount / totalInvoices : 0
        },
        monthlyBreakdown: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data
        })).sort((a, b) => b.month.localeCompare(a.month)),
        topClients
      }
    });
  } catch (error) {
    logger.error(`Error fetching invoice analytics: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to fetch invoice analytics' });
  }
};

module.exports = {
  getAllInvoices,
  getClientInvoices,
  getOrderInvoices,
  getInvoiceDetails,
  regenerateInvoicePDF,
  getInvoiceAnalytics
};