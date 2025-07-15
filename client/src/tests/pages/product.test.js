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
  selectDropdownOption,
  toggleCheckbox,
  mockCookies,
  generateTestProduct
} from '../utils/testUtils';
import { 
  mockProducts, 
  mockProductGroups,
  mockProductFormData, 
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

describe('Product Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Product List Page', () => {
    it('should display product list with correct headers', async () => {
      renderWithProviders(<Products />);

      await waitFor(() => {
        expectTableHeaders([
          'Name',
          'Alias',
          'Product Group',
          'Unit Type',
          'Rate per Unit',
          'Actions'
        ]);
      });
    });

    it('should display product data in table', async () => {
      renderWithProviders(<Products />);

      await waitFor(() => {
        mockProducts.forEach(product => {
          expectTableRow({
            name: product.name,
            alias: product.alias,
            unitType: product.unitType,
            ratePerUnit: product.ratePerUnit.toString()
          });
        });
      });
    });

    it('should show loading state while fetching products', () => {
      renderWithProviders(<Products />);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should show empty state when no products exist', async () => {
      server.use(
        rest.get('http://localhost:3010/product/all', (req, res, ctx) => {
          return res(ctx.json({ message: 'Products fetched successfully', products: [] }));
        })
      );

      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      });
    });

    it('should handle API error when fetching products', async () => {
      server.use(
        rest.get('http://localhost:3010/product/all', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch products/i)).toBeInTheDocument();
      });
    });
  });

  describe('Product Search', () => {
    it('should search products by name', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'Paver');

      await waitFor(() => {
        expect(searchInput).toHaveValue('Paver');
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByText('Unipaver')).toBeInTheDocument();
        expect(screen.queryByText('Damru Set')).not.toBeInTheDocument();
      });
    });

    it('should search products by alias', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'ISP');

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.queryByText('Unipaver')).not.toBeInTheDocument();
      });
    });

    it('should show all products when search is cleared', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'Paver');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByText('Unipaver')).toBeInTheDocument();
        expect(screen.getByText('Damru Set')).toBeInTheDocument();
      });
    });

    it('should handle search API error', async () => {
      server.use(
        rest.get('http://localhost:3010/product/search/:searchTerm', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Products />);

      const searchInput = screen.getByPlaceholderText(/search products/i);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(screen.getByText(/search failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Add Product Form', () => {
    it('should open add product modal when button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText(/add product/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add product/i);
      await user.click(addButton);

      expect(screen.getByText(/add new product/i)).toBeInTheDocument();
    });

    it('should validate required fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      await submitForm();

      expectValidationError('Product name is required');
      expectValidationError('Product group is required');
      expectValidationError('Unit type is required');
      expectValidationError('Rate per unit is required');
    });

    it('should validate rate per unit is positive', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      const rateInput = screen.getByLabelText(/rate per unit/i);
      await user.type(rateInput, '-100');

      await submitForm();
      expectValidationError('Rate per unit must be positive');
    });

    it('should validate alternate units when provided', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      // Fill required fields first
      await fillForm({
        name: 'Test Product',
        alias: 'TP',
        productGroupId: 'group-1',
        unitType: 'SQUARE_METER',
        ratePerUnit: '100'
      });

      // Toggle alternate units
      const alternateUnitsCheckbox = screen.getByLabelText(/enable alternate units/i);
      await user.click(alternateUnitsCheckbox);

      // Try to submit without filling alternate units
      await submitForm();
      expectValidationError('Number of items is required');
      expectValidationError('Number of units is required');
    });

    it('should successfully create product with valid data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      await fillForm(mockProductFormData);
      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product added successfully');
      });
    });

    it('should handle API error when creating product', async () => {
      server.use(
        rest.post('http://localhost:3010/product', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      await fillForm(mockProductFormData);
      await submitForm();

      await waitFor(() => {
        expectToastError('Failed to add product');
      });
    });

    it('should load product groups in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
        expect(screen.getByText('Decorative Items')).toBeInTheDocument();
      });
    });

    it('should handle SET unit type correctly', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      await fillForm({
        name: 'Test Set Product',
        alias: 'TSP',
        productGroupId: 'group-2',
        unitType: 'SET',
        ratePerUnit: '500'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product added successfully');
      });
    });

    it('should close modal after successful product creation', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      await fillForm(mockProductFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.queryByText(/add new product/i)).not.toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      await fillForm(mockProductFormData);
      await submitForm();

      await waitFor(() => {
        expect(screen.getByLabelText(/product name/i)).toHaveValue('');
        expect(screen.getByLabelText(/alias/i)).toHaveValue('');
        expect(screen.getByLabelText(/rate per unit/i)).toHaveValue('');
      });
    });
  });

  describe('Edit Product', () => {
    it('should open edit modal when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      expect(screen.getByText(/edit product/i)).toBeInTheDocument();
    });

    it('should pre-fill form with existing product data', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ISP')).toBeInTheDocument();
        expect(screen.getByDisplayValue('150')).toBeInTheDocument();
      });
    });

    it('should successfully update product', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      const nameInput = screen.getByLabelText(/product name/i);
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Product Name');

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product updated successfully');
      });
    });

    it('should handle alternate units in edit mode', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /edit/i });
      await user.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByDisplayValue('10')).toBeInTheDocument(); // numberOfItems
        expect(screen.getByDisplayValue('5')).toBeInTheDocument();  // numberOfUnits
      });
    });
  });

  describe('Delete Product', () => {
    it('should show confirmation dialog when delete button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    it('should cancel deletion when cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    });

    it('should successfully delete product when confirmed', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastSuccess('Product deleted successfully');
      });
    });

    it('should handle API error when deleting product', async () => {
      server.use(
        rest.delete('http://localhost:3010/product/:productId', (req, res, ctx) => {
          return res(ctx.status(500), ctx.json(mockErrorResponse));
        })
      );

      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expectToastError('Failed to delete product');
      });
    });
  });

  describe('Product Group Integration', () => {
    it('should display product group name in table', async () => {
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText('Pavers')).toBeInTheDocument();
        expect(screen.getByText('Decorative Items')).toBeInTheDocument();
      });
    });

    it('should filter products by product group', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText(/filter by group/i)).toBeInTheDocument();
      });

      const filterDropdown = screen.getByLabelText(/filter by group/i);
      await user.click(filterDropdown);
      
      const paversOption = screen.getByText('Pavers');
      await user.click(paversOption);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByText('Unipaver')).toBeInTheDocument();
        expect(screen.queryByText('Damru Set')).not.toBeInTheDocument();
      });
    });

    it('should show all products when "All Groups" is selected', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      const filterDropdown = screen.getByLabelText(/filter by group/i);
      await user.click(filterDropdown);
      
      const allGroupsOption = screen.getByText('All Groups');
      await user.click(allGroupsOption);

      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
        expect(screen.getByText('Unipaver')).toBeInTheDocument();
        expect(screen.getByText('Damru Set')).toBeInTheDocument();
      });
    });
  });

  describe('Unit Type Handling', () => {
    it('should display all unit types in dropdown', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');

      const unitTypeDropdown = screen.getByLabelText(/unit type/i);
      await user.click(unitTypeDropdown);

      await waitFor(() => {
        expect(screen.getByText('SQUARE_METER')).toBeInTheDocument();
        expect(screen.getByText('SQUARE_FEET')).toBeInTheDocument();
        expect(screen.getByText('NOS')).toBeInTheDocument();
        expect(screen.getByText('SET')).toBeInTheDocument();
      });
    });

    it('should handle SET unit type without alternate units', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      await fillForm({
        name: 'Test Set Product',
        alias: 'TSP',
        productGroupId: 'group-2',
        unitType: 'SET',
        ratePerUnit: '500'
      });

      // SET unit type should not require alternate units
      const alternateUnitsCheckbox = screen.queryByLabelText(/enable alternate units/i);
      expect(alternateUnitsCheckbox).not.toBeInTheDocument();

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product added successfully');
      });
    });

    it('should require alternate units for non-SET unit types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      await fillForm({
        name: 'Test Product',
        alias: 'TP',
        productGroupId: 'group-1',
        unitType: 'SQUARE_METER',
        ratePerUnit: '100'
      });

      // Non-SET unit types should show alternate units option
      const alternateUnitsCheckbox = screen.getByLabelText(/enable alternate units/i);
      expect(alternateUnitsCheckbox).toBeInTheDocument();
    });
  });

  describe('Form Validation Edge Cases', () => {
    it('should handle very long product names', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      const nameInput = screen.getByLabelText(/product name/i);
      const longName = 'A'.repeat(1000);
      await user.type(nameInput, longName);

      await submitForm();
      expectValidationError('Name is too long');
    });

    it('should handle special characters in alias', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      const aliasInput = screen.getByLabelText(/alias/i);
      await user.type(aliasInput, 'Test@#$%');

      await submitForm();
      expectNoValidationError('Invalid alias format');
    });

    it('should handle decimal rates', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      await fillForm({
        name: 'Test Product',
        alias: 'TP',
        productGroupId: 'group-1',
        unitType: 'SQUARE_METER',
        ratePerUnit: '99.99'
      });

      await submitForm();

      await waitFor(() => {
        expectToastSuccess('Product added successfully');
      });
    });

    it('should handle zero rate per unit', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await openModal('Add Product');
      
      const rateInput = screen.getByLabelText(/rate per unit/i);
      await user.type(rateInput, '0');

      await submitForm();
      expectValidationError('Rate per unit must be positive');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByLabelText(/search products/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/add product/i)).toBeInTheDocument();
      });
    });

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Products />);

      await waitFor(() => {
        expect(screen.getByText(/add product/i)).toBeInTheDocument();
      });

      const addButton = screen.getByText(/add product/i);
      addButton.focus();
      expect(addButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(screen.getByText(/add new product/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render product list within acceptable time', async () => {
      const startTime = performance.now();
      
      renderWithProviders(<Products />);
      
      await waitFor(() => {
        expect(screen.getByText('I-Shape Paver')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle large number of products efficiently', async () => {
      const largeProductList = Array.from({ length: 100 }, (_, index) => 
        generateTestProduct({ 
          _id: `product-${index}`,
          name: `Product ${index}`,
          alias: `P${index}`
        })
      );

      server.use(
        rest.get('http://localhost:3010/product/all', (req, res, ctx) => {
          return res(ctx.json({ 
            message: 'Products fetched successfully', 
            products: largeProductList 
          }));
        })
      );

      const startTime = performance.now();
      
      renderWithProviders(<Products />);
      
      await waitFor(() => {
        expect(screen.getByText('Product 0')).toBeInTheDocument();
        expect(screen.getByText('Product 99')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(2000); // Should render within 2 seconds
    });
  });
}); 