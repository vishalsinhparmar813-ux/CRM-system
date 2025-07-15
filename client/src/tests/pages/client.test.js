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
  performSearch,
  expectTableHeaders,
  expectTableRow,
  openModal,
  closeModal,
  mockCookies,
  generateTestClient
} from '../utils/testUtils';
import { 
  mockClients, 
  mockClientFormData, 
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

describe('Client Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Client List Page', () => {
    it('should display client list with correct headers', async () => {
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expectTableHeaders([
          'Name',
          'Alias',
          'Email',
          'Mobile',
          'Actions'
        ]);
      });
    });

    it('should display client data in table', async () => {
      renderWithProviders(<Clients />);

      await waitFor(() => {
        mockClients.forEach(client => {
          expectTableRow({
            name: client.name,
            alias: client.alias,
            email: client.email,
            mobile: client.mobile
          });
        });
      });
    });

    it('should show loading state while fetching clients', () => {
      renderWithProviders(<Clients />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show empty state when no clients exist', async () => {
      server.use(
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText(/no clients found/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching clients', async () => {
      server.use(
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch clients/i)).toBeInTheDocument();
      });
    });
  });

  describe('Client Search', () => {
    it('should search clients by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search clients/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'John');

      await waitFor(() => {
        expect(searchInput).toHaveValue('John');
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should search clients by alias', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'JD');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should search clients by mobile number', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, '9876543210');

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });

    it('should show all clients when search is cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'John');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });
    });

    it('should handle search API error', async () => {
      server.use(
        rest.get('http://localhost:3010/client/search/:searchTerm', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      const searchInput = screen.getByPlaceholderText(/search clients/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/search failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Client Form', () => {
    it('should open add client modal when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText(/add client/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add client/i);
      await user.click(addButton);

      expect(screen.getByText(/add new client/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await submitForm();

      expectValidationError('Client name is required');
      expectValidationError('Email is required');
      expectValidationError('Mobile number is required');
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');

      await submitForm();
      expectValidationError('Please enter a valid email address');
    });

    it('should validate mobile number format', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const mobileInput = screen.getByLabelText(/mobile/i);
      await user.type(mobileInput, '123');

      await submitForm();
      expectValidationError('Please enter a valid 10-digit mobile number');
    });

    it('should successfully create client with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Client added successfully');
      });
    });

    it('should handle API error when creating client', async () => {
      server.use(
        rest.post('http://localhost:3010/client', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expectToastError('Failed to add client');
      });
    });

    it('should handle "Client already exists" error specifically', async () => {
      server.use(
        rest.post('http://localhost:3010/client', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ message: 'Client already exists' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByText('Client already exists')).toBeInTheDocument();
      });
    });

    it('should handle "Client with this email already exists" error specifically', async () => {
      server.use(
        rest.post('http://localhost:3010/client', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ message: 'Client with this email already exists' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByText('Client with this email already exists')).toBeInTheDocument();
      });
    });

    it('should handle "Client with this mobile number already exists" error specifically', async () => {
      server.use(
        rest.post('http://localhost:3010/client', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ message: 'Client with this mobile number already exists' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByText('Client with this mobile number already exists')).toBeInTheDocument();
      });
    });

    it('should show duplicate email error in real-time validation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'john.doe@example.com');

      // Mock search response to simulate existing client
      server.use(
        rest.get('http://localhost:3010/client/search/john.doe@example.com', (req, res, ctx) => {
          return res(ctx.json([{
            _id: 'existing-client-id',
            name: 'John Doe',
            email: 'john.doe@example.com',
            mobile: '9876543210'
          }]));
        })
      );

      // Wait for debounced validation
      await waitFor(() => {
        expect(screen.getByText('A client with this email already exists')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should show duplicate mobile error in real-time validation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const mobileInput = screen.getByLabelText(/mobile/i);
      await user.type(mobileInput, '9876543210');

      // Mock search response to simulate existing client
      server.use(
        rest.get('http://localhost:3010/client/search/9876543210', (req, res, ctx) => {
          return res(ctx.json([{
            _id: 'existing-client-id',
            name: 'John Doe',
            email: 'john.doe@example.com',
            mobile: '9876543210'
          }]));
        })
      );

      // Wait for debounced validation
      await waitFor(() => {
        expect(screen.getByText('A client with this mobile number already exists')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('should close modal after successful client creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.queryByText(/add new client/i)).not.toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      await fillForm(mockClientFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/client name/i)).toHaveValue('');
        expect(screen.getByLabelText(/email/i)).toHaveValue('');
        expect(screen.getByLabelText(/mobile/i)).toHaveValue('');
      });
    });

    it('should handle same address checkbox', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const sameAddressCheckbox = screen.getByLabelText(/correspondence address is same as permanent address/i);
      await user.click(sameAddressCheckbox);

      // Fill permanent address
      const countryInput = screen.getByLabelText(/country/i);
      await user.type(countryInput, 'India');

      // Check if correspondence address is automatically filled
      expect(screen.getAllByDisplayValue('India')).toHaveLength(2);
    });
  });

  describe('Edit Client', () => {
    it('should open edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      expect(screen.getByText(/edit client/i)).toBeInTheDocument();
    });

    it('should pre-fill form with existing client data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
        expect(screen.getByDisplayValue('john.doe@example.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('9876543210')).toBeInTheDocument();
      });
    });

    it('should successfully update client', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByLabelText(/client name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Name');

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Client updated successfully');
      });
    });
  });

  describe('Delete Client', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should cancel deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    it('should successfully delete client when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastSuccess('Client deleted successfully');
      });
    });

    it('should handle API error when deleting client', async () => {
      server.use(
        rest.delete('http://localhost:3010/client/:clientId', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastError('Failed to delete client');
      });
    });
  });

  describe('Client Details', () => {
    it('should navigate to client details when view button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: /view/i });
      await user.click(viewButtons[0]);

      // Should navigate to client details page
      expect(window.location.pathname).toContain('/client/');
    });
  });

  describe('Form Validation Edge Cases', () => {
    it('should handle very long names', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const nameInput = screen.getByLabelText(/client name/i);
      const longName = 'A'.repeat(1000);
      await user.type(nameInput, longName);

      await submitForm();
      expectValidationError('Name is too long');
    });

    it('should handle special characters in alias', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const aliasInput = screen.getByLabelText(/alias/i);
      await user.type(aliasInput, 'Test@#$%');

      await submitForm();
      expectNoValidationError('Invalid alias format');
    });

    it('should handle international phone numbers', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await openModal('Add Client');
      
      const mobileInput = screen.getByLabelText(/mobile/i);
      await user.type(mobileInput, '+91-98765-43210');

      await submitForm();
      expectValidationError('Please enter a valid 10-digit mobile number');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByLabelText(/search clients/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/add client/i)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Clients />);

      await waitFor(() => {
        expect(screen.getByText(/add client/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add client/i);
      addButton.focus();
      expect(addButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/add new client/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render client list within acceptable time', async () => {
      const startTime = performance.now();
      
      renderWithProviders(<Clients />);
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle large number of clients efficiently', async () => {
      const largeClientList = Array.from({ length: 100 }, (_, index) => 
        generateTestClient({ 
          _id: `client-${index}`,
          name: `Client ${index}`,
          email: `client${index}@example.com`
        })
      );

      server.use(
        rest.get('http://localhost:3010/client/all', (req, res, ctx) => {
          return res(ctx.json(largeClientList));
        })
      );

      const startTime = performance.now();
      
      renderWithProviders(<Clients />);
      
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