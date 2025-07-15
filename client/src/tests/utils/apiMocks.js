import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { mockApiResponses, mockClients, mockProducts, mockProductGroups, mockOrders, mockTransactions, mockDebtsData } from './mockData';

const API_BASE_URL = 'http://localhost:3010';

// Create MSW server
export const server = setupServer(
  // Client API endpoints
  rest.get(`${API_BASE_URL}/client/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockClients)
    );
  }),

  rest.get(`${API_BASE_URL}/client/search/:searchTerm`, (req, res, ctx) => {
    const { searchTerm } = req.params;
    const filteredClients = mockClients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.alias.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.mobile.includes(searchTerm)
    );
    return res(
      ctx.status(200),
      ctx.json(filteredClients)
    );
  }),

  rest.post(`${API_BASE_URL}/client`, (req, res, ctx) => {
    const clientData = req.body;
    if (!clientData.name || !clientData.email || !clientData.mobile) {
      return res(
        ctx.status(400),
        ctx.json({ message: 'Required fields missing' })
      );
    }
    return res(
      ctx.status(201),
      ctx.json(mockApiResponses.clientCreated)
    );
  }),

  rest.get(`${API_BASE_URL}/client/:clientId`, (req, res, ctx) => {
    const { clientId } = req.params;
    const client = mockClients.find(c => c._id === clientId);
    if (!client) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Client not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json(client)
    );
  }),

  rest.delete(`${API_BASE_URL}/client/:clientId`, (req, res, ctx) => {
    const { clientId } = req.params;
    const client = mockClients.find(c => c._id === clientId);
    if (!client) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Client not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ success: true, message: 'Client deleted successfully' })
    );
  }),

  // Product API endpoints
  rest.get(`${API_BASE_URL}/product/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockApiResponses.productsList)
    );
  }),

  rest.get(`${API_BASE_URL}/product/search/:searchTerm`, (req, res, ctx) => {
    const { searchTerm } = req.params;
    const filteredProducts = mockProducts.filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.alias.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return res(
      ctx.status(200),
      ctx.json({ message: 'Products searched successfully', products: filteredProducts })
    );
  }),

  rest.post(`${API_BASE_URL}/product`, (req, res, ctx) => {
    const productData = req.body;
    if (!productData.name || !productData.unitType || !productData.ratePerUnit) {
      return res(
        ctx.status(400),
        ctx.json({ message: 'Required fields missing' })
      );
    }
    return res(
      ctx.status(201),
      ctx.json(mockApiResponses.productCreated)
    );
  }),

  rest.get(`${API_BASE_URL}/product/:productId`, (req, res, ctx) => {
    const { productId } = req.params;
    const product = mockProducts.find(p => p._id === productId);
    if (!product) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ message: 'Product fetched successfully', product })
    );
  }),

  rest.patch(`${API_BASE_URL}/product/:productId`, (req, res, ctx) => {
    const { productId } = req.params;
    const product = mockProducts.find(p => p._id === productId);
    if (!product) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ message: 'Product updated successfully', product: { ...product, ...req.body } })
    );
  }),

  rest.delete(`${API_BASE_URL}/product/:productId`, (req, res, ctx) => {
    const { productId } = req.params;
    const product = mockProducts.find(p => p._id === productId);
    if (!product) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ message: 'Product deleted successfully' })
    );
  }),

  // Product Group API endpoints
  rest.get(`${API_BASE_URL}/productGroup/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockProductGroups)
    );
  }),

  rest.post(`${API_BASE_URL}/productGroup`, (req, res, ctx) => {
    const groupData = req.body;
    if (!groupData.name) {
      return res(
        ctx.status(400),
        ctx.json({ message: 'Product group name is required' })
      );
    }
    return res(
      ctx.status(201),
      ctx.json(mockApiResponses.productGroupCreated)
    );
  }),

  rest.get(`${API_BASE_URL}/productGroup/:groupId`, (req, res, ctx) => {
    const { groupId } = req.params;
    const group = mockProductGroups.find(g => g._id === groupId);
    if (!group) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product group not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json(group)
    );
  }),

  rest.patch(`${API_BASE_URL}/productGroup/:groupId`, (req, res, ctx) => {
    const { groupId } = req.params;
    const group = mockProductGroups.find(g => g._id === groupId);
    if (!group) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product group not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ 
        success: true, 
        message: 'Product group updated successfully',
        productGroup: { ...group, ...req.body }
      })
    );
  }),

  rest.delete(`${API_BASE_URL}/productGroup/:groupId`, (req, res, ctx) => {
    const { groupId } = req.params;
    const group = mockProductGroups.find(g => g._id === groupId);
    if (!group) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Product group not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json({ success: true, message: 'Product group deleted successfully' })
    );
  }),

  // Order API endpoints
  rest.get(`${API_BASE_URL}/order/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockApiResponses.ordersList)
    );
  }),

  rest.post(`${API_BASE_URL}/order`, (req, res, ctx) => {
    const orderData = req.body;
    if (!orderData.clientId || !orderData.productId || !orderData.quantity) {
      return res(
        ctx.status(400),
        ctx.json({ message: 'Required fields missing' })
      );
    }
    return res(
      ctx.status(201),
      ctx.json(mockApiResponses.orderCreated)
    );
  }),

  rest.get(`${API_BASE_URL}/order/:orderId`, (req, res, ctx) => {
    const { orderId } = req.params;
    const order = mockOrders.find(o => o._id === orderId);
    if (!order) {
      return res(
        ctx.status(404),
        ctx.json({ message: 'Order not found' })
      );
    }
    return res(
      ctx.status(200),
      ctx.json(order)
    );
  }),

  // Sub-Order API endpoints
  rest.get(`${API_BASE_URL}/sub-order/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockSubOrders)
    );
  }),

  rest.post(`${API_BASE_URL}/sub-order`, (req, res, ctx) => {
    const subOrderData = req.body;
    if (!subOrderData.orderNo || !subOrderData.clientId || !subOrderData.productId || !subOrderData.quantity) {
      return res(
        ctx.status(400),
        ctx.json({ message: 'Required fields missing' })
      );
    }
    return res(
      ctx.status(201),
      ctx.json({ 
        message: 'Sub-order created successfully', 
        subOrderId: 'suborder-test',
        orderId: subOrderData.orderId,
        orderNo: subOrderData.orderNo
      })
    );
  }),

  // Transaction API endpoints
  rest.get(`${API_BASE_URL}/transaction/all`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockApiResponses.transactionsList)
    );
  }),

  // Error handlers
  rest.all('*', (req, res, ctx) => {
    console.warn(`No handler found for ${req.method} ${req.url}`);
    return res(
      ctx.status(500),
      ctx.json({ message: 'Internal server error' })
    );
  })
);

// Custom handlers for specific test scenarios
export const createErrorHandler = (endpoint, statusCode = 500) => {
  return rest.all(endpoint, (req, res, ctx) => {
    return res(
      ctx.status(statusCode),
      ctx.json({ message: 'Test error response' })
    );
  });
};

export const createNetworkErrorHandler = (endpoint) => {
  return rest.all(endpoint, (req, res, ctx) => {
    return res.networkError('Failed to connect');
  });
};

export const createTimeoutHandler = (endpoint, delay = 5000) => {
  return rest.all(endpoint, async (req, res, ctx) => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return res(
      ctx.status(408),
      ctx.json({ message: 'Request timeout' })
    );
  });
}; 