// Mock data for testing all features

export const mockClients = [
  {
    _id: "client-1",
    clientNo: 1,
    name: "John Doe",
    alias: "JD",
    email: "john.doe@example.com",
    mobile: "9876543210",
    correspondenceAddress: {
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      area: "Andheri",
      postalCode: "400058",
      landmark: "Near Metro Station"
    },
    permanentAddress: {
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      area: "Bandra",
      postalCode: "400050",
      landmark: "Near Bandra Station"
    },
    orders: ["order-1", "order-2"],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  },
  {
    _id: "client-2",
    clientNo: 2,
    name: "Jane Smith",
    alias: "JS",
    email: "jane.smith@example.com",
    mobile: "9876543211",
    correspondenceAddress: {
      country: "India",
      state: "Delhi",
      city: "New Delhi",
      area: "Connaught Place",
      postalCode: "110001",
      landmark: "Near CP Metro"
    },
    permanentAddress: {
      country: "India",
      state: "Delhi",
      city: "New Delhi",
      area: "Connaught Place",
      postalCode: "110001",
      landmark: "Near CP Metro"
    },
    orders: ["order-3"],
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z"
  }
];

export const mockProducts = [
  {
    _id: "product-1",
    name: "I-Shape Paver",
    alias: "ISP",
    productGroupId: "group-1",
    unitType: "SQUARE_METER",
    alternateUnits: {
      numberOfItems: 10,
      numberOfUnits: 5
    },
    ratePerUnit: 150.00,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  },
  {
    _id: "product-2",
    name: "Unipaver",
    alias: "UNI",
    productGroupId: "group-1",
    unitType: "SQUARE_FEET",
    alternateUnits: {
      numberOfItems: 8,
      numberOfUnits: 4
    },
    ratePerUnit: 12.50,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z"
  },
  {
    _id: "product-3",
    name: "Damru Set",
    alias: "DAM",
    productGroupId: "group-2",
    unitType: "SET",
    ratePerUnit: 500.00,
    createdAt: "2024-01-03T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z"
  },
  {
    _id: "product-4",
    name: "Stone Finish 200x200",
    alias: "SF200",
    productGroupId: "group-3",
    unitType: "NOS",
    ratePerUnit: 25.00,
    createdAt: "2024-01-04T00:00:00.000Z",
    updatedAt: "2024-01-04T00:00:00.000Z"
  }
];

export const mockProductGroups = [
  {
    _id: "group-1",
    name: "Pavers",
    description: "Interlocking paver blocks",
    isActive: true,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z"
  },
  {
    _id: "group-2",
    name: "Decorative Items",
    description: "Decorative garden items",
    isActive: true,
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-02T00:00:00.000Z"
  },
  {
    _id: "group-3",
    name: "Stone Finishes",
    description: "Stone finish products",
    isActive: false,
    createdAt: "2024-01-03T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z"
  }
];

export const mockOrders = [
  {
    _id: "order-1",
    orderNo: 1001,
    date: "2024-01-15T00:00:00.000Z",
    clientId: "client-1",
    productId: "product-1",
    quantity: 50,
    remQuantity: 30,
    unitType: "SQUARE_METER",
    discount: 5,
    amount: 7125.00,
    dueDate: "2024-02-15T00:00:00.000Z",
    status: "PENDING",
    type: "SALES_ORDER",
    subOrders: ["suborder-1"],
    transactions: ["transaction-1"],
    txnStatus: "PARTIAL",
    createdAt: "2024-01-15T00:00:00.000Z",
    updatedAt: "2024-01-15T00:00:00.000Z"
  },
  {
    _id: "order-2",
    orderNo: 1002,
    date: "2024-01-16T00:00:00.000Z",
    clientId: "client-1",
    productId: "product-2",
    quantity: 100,
    remQuantity: 0,
    unitType: "SQUARE_FEET",
    discount: 0,
    amount: 1250.00,
    dueDate: "2024-02-16T00:00:00.000Z",
    status: "COMPLETED",
    type: "SALES_ORDER",
    subOrders: ["suborder-2"],
    transactions: ["transaction-2"],
    txnStatus: "COMPLETED",
    createdAt: "2024-01-16T00:00:00.000Z",
    updatedAt: "2024-01-16T00:00:00.000Z"
  },
  {
    _id: "order-3",
    orderNo: 1003,
    date: "2024-01-17T00:00:00.000Z",
    clientId: "client-2",
    productId: "product-3",
    quantity: 5,
    remQuantity: 5,
    unitType: "SET",
    discount: 10,
    amount: 2250.00,
    dueDate: "2024-02-17T00:00:00.000Z",
    status: "PENDING",
    type: "SALES_ORDER",
    subOrders: [],
    transactions: [],
    txnStatus: "PENDING",
    createdAt: "2024-01-17T00:00:00.000Z",
    updatedAt: "2024-01-17T00:00:00.000Z"
  }
];

export const mockSubOrders = [
  {
    _id: "suborder-1",
    orderNo: 1001,
    date: "2024-01-20T00:00:00.000Z",
    clientId: "client-1",
    productId: "product-1",
    quantity: 20,
    status: "COMPLETED",
    unitType: "SQUARE_METER",
    type: "DELIVERY",
    createdAt: "2024-01-20T00:00:00.000Z",
    updatedAt: "2024-01-20T00:00:00.000Z"
  },
  {
    _id: "suborder-2",
    orderNo: 1002,
    date: "2024-01-21T00:00:00.000Z",
    clientId: "client-1",
    productId: "product-2",
    quantity: 100,
    status: "COMPLETED",
    unitType: "SQUARE_FEET",
    type: "DELIVERY",
    createdAt: "2024-01-21T00:00:00.000Z",
    updatedAt: "2024-01-21T00:00:00.000Z"
  }
];

export const mockTransactions = [
  {
    _id: "transaction-1",
    clientId: "client-1",
    orderId: "order-1",
    amount: 3562.50,
    type: "PAYMENT",
    method: "BANK_TRANSFER",
    date: "2024-01-25T00:00:00.000Z",
    reference: "TXN001",
    status: "COMPLETED",
    createdAt: "2024-01-25T00:00:00.000Z",
    updatedAt: "2024-01-25T00:00:00.000Z"
  },
  {
    _id: "transaction-2",
    clientId: "client-1",
    orderId: "order-2",
    amount: 1250.00,
    type: "PAYMENT",
    method: "CASH",
    date: "2024-01-26T00:00:00.000Z",
    reference: "TXN002",
    status: "COMPLETED",
    createdAt: "2024-01-26T00:00:00.000Z",
    updatedAt: "2024-01-26T00:00:00.000Z"
  }
];

// Form data for testing
export const mockClientFormData = {
  name: "Test Client",
  alias: "TC",
  email: "test@example.com",
  mobile: "9876543210",
  correspondenceAddress: {
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    area: "Test Area",
    postalCode: "400001",
    landmark: "Test Landmark"
  },
  permanentAddress: {
    country: "India",
    state: "Maharashtra",
    city: "Mumbai",
    area: "Test Area",
    postalCode: "400001",
    landmark: "Test Landmark"
  }
};

export const mockProductFormData = {
  name: "Test Product",
  alias: "TP",
  productGroupId: "group-1",
  unitType: "SQUARE_METER",
  ratePerUnit: 100.00,
  alternateUnits: {
    numberOfItems: 10,
    numberOfUnits: 5
  }
};

export const mockOrderFormData = {
  clientId: "client-1",
  productId: "product-1",
  quantity: "25",
  discount: "5",
  dueDate: "2024-02-28"
};

export const mockProductGroupFormData = {
  name: "Test Group",
  description: "Test description",
  isActive: true
};

// Error scenarios
export const mockErrorResponse = {
  message: "An error occurred",
  status: 500
};

export const mockValidationError = {
  message: "Validation failed",
  errors: {
    name: "Name is required",
    email: "Invalid email format"
  }
};

// Search scenarios
export const mockSearchResults = {
  clients: mockClients.filter(client => 
    client.name.toLowerCase().includes("john") ||
    client.alias.toLowerCase().includes("jd") ||
    client.mobile.includes("9876543210")
  ),
  products: mockProducts.filter(product => 
    product.name.toLowerCase().includes("paver") ||
    product.alias.toLowerCase().includes("isp")
  )
};

// Debts calculation data
export const mockDebtsData = [
  {
    clientId: "client-1",
    clientName: "John Doe",
    clientAlias: "JD",
    clientMobile: "9876543210",
    totalOrderAmount: 8375.00,
    totalPaidAmount: 4812.50,
    outstandingAmount: 3562.50,
    orderCount: 2,
    transactionCount: 2
  },
  {
    clientId: "client-2",
    clientName: "Jane Smith",
    clientAlias: "JS",
    clientMobile: "9876543211",
    totalOrderAmount: 2250.00,
    totalPaidAmount: 0,
    outstandingAmount: 2250.00,
    orderCount: 1,
    transactionCount: 0
  }
];

// API response formats
export const mockApiResponses = {
  success: {
    success: true,
    message: "Operation completed successfully"
  },
  clientCreated: {
    success: true,
    message: "Client created successfully",
    client: mockClients[0]
  },
  productCreated: {
    message: "Product created successfully",
    product: mockProducts[0]
  },
  productGroupCreated: {
    success: true,
    message: "Product group created successfully",
    productGroup: mockProductGroups[0]
  },
  orderCreated: {
    message: "Order created successfully",
    orderId: "order-1"
  },
  clientsList: mockClients,
  productsList: {
    message: "Products fetched successfully",
    products: mockProducts
  },
  productGroupsList: mockProductGroups,
  ordersList: {
    orders: mockOrders
  },
  transactionsList: {
    transactions: mockTransactions
  }
}; 