import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { server } from '../utils/apiMocks';
import { 
  renderWithProviders, 
  fillForm, 
  submitForm, 
  expectValidationError,
  expectNoValidationError,
  expectToastSuccess,
  expectToastError,
  expectTableHeaders,
  expectTableRow,
  openModal,
  closeModal,
  selectDropdownOption,
  selectDate,
  mockCookies
} from '../utils/testUtils';
import { 
  mockOrders, 
  mockClients,
  mockProducts,
  mockOrderFormData, 
  mockErrorResponse,
  mockValidationError 
} from '../utils/mockData';

// Mock the useApi hook
jest.mock('../../hooks/useApi', () => ({
  __esModule: true,
  default: () => ({
    apiCall: jest.fn()
  })
}));

// Mock universal-cookie
jest.mock('universal-cookie', () => {
  return jest.fn().mockImplementation(() => mockCookies);
});

// Mock useToast hook
jest.mock('../../hooks/useToast', () => ({
  __esModule: true,
  default: () => ({
    toastSuccess: jest.fn(),
    toastError: jest.fn()
  })
}));

describe('Order Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Order List Page', () => {
    it('should display order list with correct headers', async () => {
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expectTableHeaders([
          'Order No',
          'Date',
          'Client',
          'Product',
          'Quantity',
          'Amount',
          'Status',
          'Actions'
        ]);
      });
    });

    it('should display order data in table', async () => {
      renderWithProviders(<Orders />);

      await waitFor(() => {
        mockOrders.forEach(order => {
          expectTableRow({
            orderNo: order.orderNo.toString(),
            quantity: order.quantity.toString(),
            amount: order.amount.toString()
          });
        });
      });
    });

    it('should show loading state while fetching orders', () => {
      renderWithProviders(<Orders />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show empty state when no orders exist', async () => {
      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: [] }));
        })
      );

      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText(/no orders found/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching orders', async () => {
      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch orders/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Order Form', () => {
    it('should open add order modal when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText(/add order/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add order/i);
      await user.click(addButton);

      expect(screen.getByText(/add new order/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      await submitForm();

      expectValidationError('Client is required');
      expectValidationError('Product is required');
      expectValidationError('Quantity is required');
    });

    it('should validate quantity is positive', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.type(quantityInput, '-10');

      await submitForm();
      expectValidationError('Quantity must be positive');
    });

    it('should validate rate price is positive', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      const ratePriceInput = screen.getByLabelText(/rate price/i);
      await user.type(ratePriceInput, '-10');

      await submitForm();
      expectValidationError('Rate price must be greater than 0');
    });

    it('should successfully create order with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      await fillForm(mockOrderFormData);
      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });

    it('should handle API error when creating order', async () => {
      server.use(
        rest.post('http://localhost:3010/order', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      await fillForm(mockOrderFormData);
      await submitForm();

      await waitFor(() => {
        expectToastError('Failed to create order');
      });
    });

    it('should load clients in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should load products in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByText('Unipaver')).toBeInTheDocument();
        expect(screen.getByText('Damru Set')).toBeInTheDocument();
      });
    });

    it('should automatically set unit type based on selected product', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      // Select a product
      const productDropdown = screen.getByLabelText(/product/i);
      await user.click(productDropdown);
      
      const productOption = screen.getByText('I-Shape Paver');
      await user.click(productOption);

      // Check if unit type is automatically set
      await waitFor(() => {
        expect(screen.getByDisplayValue('SQUARE_METER')).toBeInTheDocument();
      });
    });

    it('should not show unit type field in form', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      // Unit type field should not be visible
      expect(screen.queryByLabelText(/unit type/i)).not.toBeInTheDocument();
    });

    it('should calculate amount automatically', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      // Fill form data
      await fillForm({
        clientId: 'client-1',
        productId: 'product-1',
        quantity: '50',
        ratePrice: '150'
      });

      // Check if amount is calculated automatically
      await waitFor(() => {
        const amountField = screen.getByLabelText(/amount/i);
        expect(amountField).toHaveValue('7125.00'); // 50 * 150 * 0.95
      });
    });

    it('should handle SET unit type products', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');

      // Select a SET product
      const productDropdown = screen.getByLabelText(/product/i);
      await user.click(productDropdown);
      
      const setProductOption = screen.getByText('Damru Set');
      await user.click(setProductOption);

      // Check if unit type is automatically set to SET
      await waitFor(() => {
        expect(screen.getByDisplayValue('SET')).toBeInTheDocument();
      });

      // Fill remaining form data
      await fillForm({
        clientId: 'client-1',
        quantity: '5',
        ratePrice: '450'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });

    it('should close modal after successful order creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      await fillForm(mockOrderFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.queryByText(/add new order/i)).not.toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      await fillForm(mockOrderFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/quantity/i)).toHaveValue('');
        expect(screen.getByLabelText(/rate price/i)).toHaveValue('');
        expect(screen.getByLabelText(/due date/i)).toHaveValue('');
      });
    });
  });

  describe('Edit Order', () => {
    it('should open edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      expect(screen.getByText(/edit order/i)).toBeInTheDocument();
    });

    it('should pre-fill form with existing order data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('50')).toBeInTheDocument(); // quantity
        expect(screen.getByDisplayValue('150')).toBeInTheDocument();  // rate price
        expect(screen.getByDisplayValue('SQUARE_METER')).toBeInTheDocument(); // unit type
      });
    });

    it('should successfully update order', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, '75');

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order updated successfully');
      });
    });

    it('should recalculate amount when quantity changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.clear(quantityInput);
      await user.type(quantityInput, '100');

      await waitFor(() => {
        const amountField = screen.getByLabelText(/amount/i);
        expect(amountField).toHaveValue('14250.00'); // 100 * 150 * 0.95
      });
    });
  });

  describe('Delete Order', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should cancel deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    it('should successfully delete order when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastSuccess('Order deleted successfully');
      });
    });

    it('should handle API error when deleting order', async () => {
      server.use(
        rest.delete('http://localhost:3010/order/:orderId', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastError('Failed to delete order');
      });
    });
  });

  describe('Order Status Management', () => {
    it('should display order status correctly', async () => {
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('PENDING')).toBeInTheDocument();
        expect(screen.getByText('COMPLETED')).toBeInTheDocument();
      });
    });

    it('should allow status updates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const statusDropdown = screen.getByLabelText(/status/i);
      await user.click(statusDropdown);
      
      const completedOption = screen.getByText('COMPLETED');
      await user.click(completedOption);

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order updated successfully');
      });
    });

    it('should update transaction status when order status changes', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const statusDropdown = screen.getByLabelText(/status/i);
      await user.click(statusDropdown);
      
      const completedOption = screen.getByText('COMPLETED');
      await user.click(completedOption);

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order updated successfully');
      });
    });
  });

  describe('Date Handling', () => {
    it('should validate due date is not in the past', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      const dueDateInput = screen.getByLabelText(/due date/i);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastDateString = pastDate.toISOString().split('T')[0];
      
      await user.type(dueDateInput, pastDateString);

      await submitForm();
      expectValidationError('Due date cannot be in the past');
    });

    it('should allow future due dates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      const dueDateInput = screen.getByLabelText(/due date/i);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateString = futureDate.toISOString().split('T')[0];
      
      await user.type(dueDateInput, futureDateString);

      await fillForm({
        clientId: 'client-1',
        productId: 'product-1',
        quantity: '25'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });
  });

  describe('Form Validation Edge Cases', () => {
    it('should handle very large quantities', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      const quantityInput = screen.getByLabelText(/quantity/i);
      await user.type(quantityInput, '999999999');

      await submitForm();
      expectValidationError('Quantity is too large');
    });

    it('should handle decimal quantities', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      await fillForm({
        clientId: 'client-1',
        productId: 'product-1',
        quantity: '25.5'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });

    it('should handle minimum rate price', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      await fillForm({
        clientId: 'client-1',
        productId: 'product-1',
        quantity: '25',
        ratePrice: '0.01'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });

    it('should handle high rate price', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await openModal('Add Order');
      
      await fillForm({
        clientId: 'client-1',
        productId: 'product-1',
        quantity: '25',
        ratePrice: '9999.99'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Order created successfully');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByLabelText(/add order/i)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Orders />);

      await waitFor(() => {
        expect(screen.getByText(/add order/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add order/i);
      addButton.focus();
      expect(addButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/add new order/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render order list within acceptable time', async () => {
      const startTime = performance.now();
      
      renderWithProviders(<Orders />);
      
      await waitFor(() => {
        expect(screen.getByText('1001')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle large number of orders efficiently', async () => {
      const largeOrderList = Array.from({ length: 100 }, (_, index) => ({
        _id: `order-${index}`,
        orderNo: 2000 + index,
        date: new Date().toISOString(),
        clientId: 'client-1',
        products: [{
          productId: 'product-1',
          quantity: 25,
          remainingQuantity: 25,
          unitType: 'SQUARE_METER',
          ratePrice: 150,
          amount: 3750.00
        }],
        quantity: 25,
        remainingQuantity: 25,
        totalAmount: 3750.00,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'PENDING',
        type: 'SALES_ORDER',
        subOrders: [],
        transactions: [],
        txnStatus: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: largeOrderList }));
        })
      );

      const startTime = performance.now();
      
      renderWithProviders(<Orders />);
      
      await waitFor(() => {
        expect(screen.getByText('2000')).toBeInTheDocument();
        expect(screen.getByText('2099')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });
  });
}); 