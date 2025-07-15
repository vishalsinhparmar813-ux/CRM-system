import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { server } from '../utils/apiMocks';
import { 
  renderWithProviders, 
  expectTableHeaders,
  expectTableRow,
  performSearch,
  expectToastError,
  mockCookies
} from '../utils/testUtils';
import { 
  mockDebtsData,
  mockOrders, 
  mockClients,
  mockTransactions,
  mockErrorResponse
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

describe('Debts List Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Debts List Page', () => {
    it('should display debts list with correct headers', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expectTableHeaders([
          'Client Name',
          'Alias',
          'Mobile',
          'Total Order Amount',
          'Total Paid Amount',
          'Outstanding Amount',
          'Order Count',
          'Actions'
        ]);
      });
    });

    it('should display debts data in table', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        mockDebtsData.forEach(debt => {
          expectTableRow({
            clientName: debt.clientName,
            clientAlias: debt.clientAlias,
            clientMobile: debt.clientMobile,
            totalOrderAmount: debt.totalOrderAmount.toString(),
            totalPaidAmount: debt.totalPaidAmount.toString(),
            outstandingAmount: debt.outstandingAmount.toString(),
            orderCount: debt.orderCount.toString()
          });
        });
      });
    });

    it('should show loading state while fetching debts data', () => {
      renderWithProviders(<DebtsList />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show empty state when no debts exist', async () => {
      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: [] }));
        }),
        rest.get('http://localhost:3010/transaction/all', (req, res, ctx) => {
          return res(ctx.json({ transactions: [] }));
        }),
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/no debts found/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching orders', async () => {
      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch orders/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching transactions', async () => {
      server.use(
        rest.get('http://localhost:3010/transaction/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch transactions/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching clients', async () => {
      server.use(
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch clients/i)).toBeInTheDocument();
      });
    });
  });

  describe('Debts Summary', () => {
    it('should display total outstanding amount', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/total outstanding amount/i)).toBeInTheDocument();
        expect(screen.getByText(/₹5,812.50/i)).toBeInTheDocument(); // 3562.50 + 2250.00
      });
    });

    it('should display total number of clients with debts', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/total clients with debts/i)).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('should display total number of pending orders', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/total pending orders/i)).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument(); // 2 pending orders
      });
    });

    it('should display average debt per client', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/average debt per client/i)).toBeInTheDocument();
        expect(screen.getByText(/₹2,906.25/i)).toBeInTheDocument(); // 5812.50 / 2
      });
    });
  });

  describe('Debt Calculation', () => {
    it('should correctly calculate outstanding amounts', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        // John Doe: 8375.00 - 4812.50 = 3562.50
        expect(screen.getByText('₹3,562.50')).toBeInTheDocument();
        
        // Jane Smith: 2250.00 - 0 = 2250.00
        expect(screen.getByText('₹2,250.00')).toBeInTheDocument();
      });
    });

    it('should handle clients with no transactions', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        // Jane Smith has no transactions, so outstanding = total order amount
        expect(screen.getByText('₹2,250.00')).toBeInTheDocument();
      });
    });

    it('should handle clients with partial payments', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        // John Doe has partial payments
        expect(screen.getByText('₹3,562.50')).toBeInTheDocument();
      });
    });

    it('should handle clients with full payments', async () => {
      // Create a client with full payment
      const fullPaymentOrder = {
        ...mockOrders[1], // Order 1002 which is completed
        clientId: 'client-3',
        amount: 1000.00
      };

      const fullPaymentTransaction = {
        ...mockTransactions[1],
        clientId: 'client-3',
        orderId: 'order-1002',
        amount: 1000.00
      };

      const fullPaymentClient = {
        ...mockClients[0],
        _id: 'client-3',
        name: 'Full Payment Client',
        alias: 'FPC',
        mobile: '9876543212'
      };

      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: [...mockOrders, fullPaymentOrder] }));
        }),
        rest.get('http://localhost:3010/transaction/all', (req, res, ctx) => {
          return res(ctx.json({ transactions: [...mockTransactions, fullPaymentTransaction] }));
        }),
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json([...mockClients, fullPaymentClient]));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        // Full Payment Client should not appear in debts list
        expect(screen.queryByText('Full Payment Client')).not.toBeInTheDocument();
      });
    });
  });

  describe('Debts Search and Filtering', () => {
    it('should search debts by client name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search debts/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search debts/i);
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(searchInput).toHaveValue('John');
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should search debts by client alias', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      const searchInput = screen.getByPlaceholderText(/search debts/i);
      await user.type(searchInput, 'JD');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should search debts by mobile number', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      const searchInput = screen.getByPlaceholderText(/search debts/i);
      await user.type(searchInput, '9876543210');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should show all debts when search is cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      const searchInput = screen.getByPlaceholderText(/search debts/i);
      await user.type(searchInput, 'John');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should filter by outstanding amount range', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/filter by amount/i)).toBeInTheDocument();
      });

      const filterDropdown = screen.getByLabelText(/filter by amount/i);
      await user.click(filterDropdown);
      
      const highDebtOption = screen.getByText('High Debt (> ₹3,000)');
      await user.click(highDebtOption);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument(); // 3562.50
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument(); // 2250.00
      });
    });

    it('should filter by debt status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/filter by status/i)).toBeInTheDocument();
      });

      const filterDropdown = screen.getByLabelText(/filter by status/i);
      await user.click(filterDropdown);
      
      const overdueOption = screen.getByText('Overdue');
      await user.click(overdueOption);

      await waitFor(() => {
        // Should show overdue debts
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });
  });

  describe('Client Details Navigation', () => {
    it('should navigate to client details when view button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // Should navigate to client details page
      expect(window.location.pathname).toContain('/client/');
    });

    it('should show client details with debt information', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/client details/i)).toBeInTheDocument();
        expect(screen.getByText(/outstanding amount/i)).toBeInTheDocument();
        expect(screen.getByText('₹3,562.50')).toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export debts list to PDF', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/export to pdf/i)).toBeInTheDocument();
      });

      const exportButton = screen.getByText(/export to pdf/i);
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/pdf generated successfully/i)).toBeInTheDocument();
      });
    });

    it('should export debts list to Excel', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/export to excel/i)).toBeInTheDocument();
      });

      const exportButton = screen.getByText(/export to excel/i);
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/excel file generated successfully/i)).toBeInTheDocument();
      });
    });

    it('should handle export errors', async () => {
      // Mock PDF generation error
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/export to pdf/i)).toBeInTheDocument();
      });

      const exportButton = screen.getByText(/export to pdf/i);
      await user.click(exportButton);

      await waitFor(() => {
        expectToastError('Failed to generate PDF');
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort by client name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/client name/i)).toBeInTheDocument();
      });

      const nameHeader = screen.getByText(/client name/i);
      await user.click(nameHeader);

      // Should sort alphabetically
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('Jane Smith'); // J comes before J
      expect(rows[2]).toHaveTextContent('John Doe');
    });

    it('should sort by outstanding amount', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/outstanding amount/i)).toBeInTheDocument();
      });

      const amountHeader = screen.getByText(/outstanding amount/i);
      await user.click(amountHeader);

      // Should sort by amount descending
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('₹3,562.50'); // Higher amount first
      expect(rows[2]).toHaveTextContent('₹2,250.00');
    });

    it('should sort by order count', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/order count/i)).toBeInTheDocument();
      });

      const countHeader = screen.getByText(/order count/i);
      await user.click(countHeader);

      // Should sort by count descending
      const rows = screen.getAllByRole('row');
      expect(rows[1]).toHaveTextContent('2'); // Higher count first
      expect(rows[2]).toHaveTextContent('1');
    });
  });

  describe('Pagination', () => {
    it('should display pagination when there are many debts', async () => {
      // Create many debt records
      const manyDebts = Array.from({ length: 25 }, (_, index) => ({
        ...mockDebtsData[0],
        _id: `debt-${index}`,
        clientName: `Client ${index}`,
        clientAlias: `C${index}`,
        clientMobile: `9876543${index.toString().padStart(3, '0')}`
      }));

      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: manyDebts.map(d => ({ ...mockOrders[0], clientId: d._id })) }));
        }),
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json(manyDebts.map(d => ({ ...mockClients[0], _id: d._id, name: d.clientName, alias: d.clientAlias, mobile: d.clientMobile }))));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/page 1 of/i)).toBeInTheDocument();
        expect(screen.getByText(/next/i)).toBeInTheDocument();
      });
    });

    it('should navigate to next page', async () => {
      const user = userEvent.setup();
      
      // Create many debt records
      const manyDebts = Array.from({ length: 25 }, (_, index) => ({
        ...mockDebtsData[0],
        _id: `debt-${index}`,
        clientName: `Client ${index}`,
        clientAlias: `C${index}`,
        clientMobile: `9876543${index.toString().padStart(3, '0')}`
      }));

      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: manyDebts.map(d => ({ ...mockOrders[0], clientId: d._id })) }));
        }),
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json(manyDebts.map(d => ({ ...mockClients[0], _id: d._id, name: d.clientName, alias: d.clientAlias, mobile: d.clientMobile }))));
        })
      );

      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/next/i)).toBeInTheDocument();
      });

      const nextButton = screen.getByText(/next/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText(/page 2 of/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByLabelText(/search debts/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/export to pdf/i)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DebtsList />);

      await waitFor(() => {
        expect(screen.getByText(/export to pdf/i)).toBeInTheDocument();
      });

      const exportButton = screen.getByText(/export to pdf/i);
      exportButton.focus();
      expect(exportButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/pdf generated successfully/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render debts list within acceptable time', async () => {
      const startTime = performance.now();
      
      renderWithProviders(<DebtsList />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle large number of debts efficiently', async () => {
      const largeDebtsList = Array.from({ length: 100 }, (_, index) => ({
        ...mockDebtsData[0],
        _id: `debt-${index}`,
        clientName: `Client ${index}`,
        clientAlias: `C${index}`,
        clientMobile: `9876543${index.toString().padStart(3, '0')}`,
        totalOrderAmount: 1000 + index * 100,
        totalPaidAmount: 500 + index * 50,
        outstandingAmount: 500 + index * 50
      }));

      server.use(
        rest.get('http://localhost:3010/order/all', (req, res, ctx) => {
          return res(ctx.json({ orders: largeDebtsList.map(d => ({ ...mockOrders[0], clientId: d._id, amount: d.totalOrderAmount })) }));
        }),
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json(largeDebtsList.map(d => ({ ...mockClients[0], _id: d._id, name: d.clientName, alias: d.clientAlias, mobile: d.clientMobile }))));
        })
      );

      const startTime = performance.now();
      
      renderWithProviders(<DebtsList />);
      
      await waitFor(() => {
        expect(screen.getByText('Client 0')).toBeInTheDocument();
        expect(screen.getByText('Client 99')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });
  });
}); 