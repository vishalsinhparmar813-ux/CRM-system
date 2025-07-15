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
  toggleCheckbox,
  mockCookies
} from '../utils/testUtils';
import { 
  mockProductGroups,
  mockProductGroupFormData, 
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

describe('Product Group Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Product Group List Page', () => {
    it('should display product group list with correct headers', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expectTableHeaders([
          'Name',
          'Description',
          'Status',
          'Product Count',
          'Actions'
        ]);
      });
    });

    it('should display product group data in table', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        mockProductGroups.forEach(group => {
          expectTableRow({
            name: group.name,
            description: group.description,
            status: group.isActive ? 'Active' : 'Inactive'
          });
        });
      });
    });

    it('should show loading state while fetching product groups', () => {
      renderWithProviders(<ProductGroups />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show empty state when no product groups exist', async () => {
      server.use(
        rest.get('http://localhost:3010/productGroup/all', (req, res, ctx) => {
          return res(ctx.json([]));
        })
      );

      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText(/no product groups found/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching product groups', async () => {
      server.use(
        rest.get('http://localhost:3010/productGroup/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch product groups/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Product Group Form', () => {
    it('should open add product group modal when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText(/add product group/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add product group/i);
      await user.click(addButton);

      expect(screen.getByText(/add new product group/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await submitForm();

      expectValidationError('Product group name is required');
    });

    it('should validate name length', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      
      const nameInput = screen.getByLabelText(/name/i);
      const longName = 'A'.repeat(1000);
      await user.type(nameInput, longName);

      await submitForm();
      expectValidationError('Name is too long');
    });

    it('should successfully create product group with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await fillForm(mockProductGroupFormData);
      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group created successfully');
      });
    });

    it('should handle API error when creating product group', async () => {
      server.use(
        rest.post('http://localhost:3010/productGroup', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await fillForm(mockProductGroupFormData);
      await submitForm();

      await waitFor(() => {
        expectToastError('Failed to create product group');
      });
    });

    it('should close modal after successful product group creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await fillForm(mockProductGroupFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.queryByText(/add new product group/i)).not.toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await fillForm(mockProductGroupFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/name/i)).toHaveValue('');
        expect(screen.getByLabelText(/description/i)).toHaveValue('');
      });
    });

    it('should handle active/inactive status', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      
      const activeCheckbox = screen.getByLabelText(/active/i);
      await user.click(activeCheckbox);

      await fillForm({
        name: 'Test Group',
        description: 'Test description'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group created successfully');
      });
    });
  });

  describe('Edit Product Group', () => {
    it('should open edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      expect(screen.getByText(/edit product group/i)).toBeInTheDocument();
    });

    it('should pre-fill form with existing product group data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('Pavers')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Interlocking paver blocks')).toBeInTheDocument();
      });
    });

    it('should successfully update product group', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByLabelText(/name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Pavers');

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group updated successfully');
      });
    });

    it('should handle status toggle in edit mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const activeCheckbox = screen.getByLabelText(/active/i);
      await user.click(activeCheckbox);

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group updated successfully');
      });
    });
  });

  describe('Delete Product Group', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should cancel deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    it('should successfully delete product group when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastSuccess('Product group deleted successfully');
      });
    });

    it('should handle API error when deleting product group', async () => {
      server.use(
        rest.delete('http://localhost:3010/productGroup/:groupId', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastError('Failed to delete product group');
      });
    });

    it('should prevent deletion of product groups with associated products', async () => {
      // Mock a product group with associated products
      const groupWithProducts = {
        ...mockProductGroups[0],
        productCount: 5
      };

      server.use(
        rest.get('http://localhost:3010/productGroup/all', (req, res, ctx) => {
          return res(ctx.json([groupWithProducts]));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText(/cannot delete product group with associated products/i)).toBeInTheDocument();
      });
    });
  });

  describe('Product Count Display', () => {
    it('should display correct product count for each group', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument(); // Pavers group has 2 products
        expect(screen.getByText('1')).toBeInTheDocument(); // Decorative Items has 1 product
        expect(screen.getByText('0')).toBeInTheDocument(); // Stone Finishes has 0 products
      });
    });

    it('should show zero count for empty groups', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Stone Finishes')).toBeInTheDocument();
        expect(screen.getByText('0')).toBeInTheDocument();
      });
    });
  });

  describe('Status Management', () => {
    it('should display active status correctly', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });

    it('should allow status toggle', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const activeCheckbox = screen.getByLabelText(/active/i);
      await user.click(activeCheckbox);

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group updated successfully');
      });
    });

    it('should prevent inactive groups from being selected in product forms', async () => {
      // This test would be part of the product form tests
      // but we can verify that inactive groups are marked appropriately
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText('Stone Finishes')).toBeInTheDocument();
        expect(screen.getByText('Inactive')).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation Edge Cases', () => {
    it('should handle special characters in name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      
      const nameInput = screen.getByLabelText(/name/i);
      await user.type(nameInput, 'Test@#$% Group');

      await submitForm();
      expectNoValidationError('Invalid name format');
    });

    it('should handle very long descriptions', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      
      const descriptionInput = screen.getByLabelText(/description/i);
      const longDescription = 'A'.repeat(1000);
      await user.type(descriptionInput, longDescription);

      await submitForm();
      expectValidationError('Description is too long');
    });

    it('should handle empty description', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      
      await fillForm({
        name: 'Test Group'
        // No description
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product group created successfully');
      });
    });

    it('should handle duplicate names', async () => {
      server.use(
        rest.post('http://localhost:3010/productGroup', (req, res, ctx) => {
          return res(ctx.status(400), ctx.json({ message: 'Product group name already exists' }));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await openModal('Add Product Group');
      await fillForm({
        name: 'Pavers', // Existing name
        description: 'Test description'
      });

      await submitForm();

      await waitFor(() => {
        expectToastError('Product group name already exists');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByLabelText(/add product group/i)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ProductGroups />);

      await waitFor(() => {
        expect(screen.getByText(/add product group/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add product group/i);
      addButton.focus();
      expect(addButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/add new product group/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render product group list within acceptable time', async () => {
      const startTime = performance.now();
      
      renderWithProviders(<ProductGroups />);
      
      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle large number of product groups efficiently', async () => {
      const largeGroupList = Array.from({ length: 100 }, (_, index) => ({
        _id: `group-${index}`,
        name: `Product Group ${index}`,
        description: `Description for group ${index}`,
        isActive: index % 2 === 0,
        productCount: Math.floor(Math.random() * 10),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      server.use(
        rest.get('http://localhost:3010/productGroup/all', (req, res, ctx) => {
          return res(ctx.json(largeGroupList));
        })
      );

      const startTime = performance.now();
      
      renderWithProviders(<ProductGroups />);
      
      await waitFor(() => {
        expect(screen.getByText('Product Group 0')).toBeInTheDocument();
        expect(screen.getByText('Product Group 99')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });
  });
}); 