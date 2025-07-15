import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { AdminContext } from '../../context/useAdmin';
import store from '../../store';

// Custom render function with providers
export const renderWithProviders = (
  ui,
  {
    preloadedState = {},
    store: customStore = store,
    adminContextValue = {
      token: 'test-token',
      role: 'admin',
      setAdminData: jest.fn(),
      logout: jest.fn()
    },
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }) => {
    return (
      <Provider store={customStore}>
        <AdminContext.Provider value={adminContextValue}>
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </AdminContext.Provider>
      </Provider>
    );
  };

  return {
    store: customStore,
    ...render(ui, { wrapper: Wrapper, ...renderOptions })
  };
};

// Mock cookies utility
export const mockCookies = {
  get: jest.fn((key) => {
    const cookies = {
      'auth-token': 'test-token',
      'user-role': 'admin'
    };
    return cookies[key];
  }),
  set: jest.fn(),
  remove: jest.fn()
};

// Form testing utilities
export const fillForm = async (formData) => {
  const user = userEvent.setup();
  
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = screen.getByLabelText(new RegExp(fieldName, 'i'));
    if (field) {
      await user.clear(field);
      await user.type(field, value.toString());
    }
  }
};

export const submitForm = async () => {
  const user = userEvent.setup();
  const submitButton = screen.getByRole('button', { name: /submit|create|add|save/i });
  await user.click(submitButton);
};

// Validation testing utilities
export const expectValidationError = (errorMessage) => {
  expect(screen.getByText(errorMessage)).toBeInTheDocument();
};

export const expectNoValidationError = (errorMessage) => {
  expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
};

// API testing utilities
export const waitForApiCall = async (apiCall) => {
  await waitFor(() => {
    expect(apiCall).toHaveBeenCalled();
  });
};

export const expectApiCallWithData = (apiCall, expectedData) => {
  expect(apiCall).toHaveBeenCalledWith(
    expect.objectContaining(expectedData)
  );
};

// Toast notification testing
export const expectToastSuccess = (message) => {
  expect(screen.getByText(message)).toBeInTheDocument();
};

export const expectToastError = (message) => {
  expect(screen.getByText(message)).toBeInTheDocument();
};

// Table testing utilities
export const expectTableHeaders = (headers) => {
  headers.forEach(header => {
    expect(screen.getByText(header)).toBeInTheDocument();
  });
};

export const expectTableRow = (rowData) => {
  Object.values(rowData).forEach(value => {
    if (value) {
      expect(screen.getByText(value.toString())).toBeInTheDocument();
    }
  });
};

// Modal testing utilities
export const openModal = async (buttonText) => {
  const user = userEvent.setup();
  const openButton = screen.getByText(buttonText);
  await user.click(openButton);
};

export const closeModal = async () => {
  const user = userEvent.setup();
  const closeButton = screen.getByRole('button', { name: /close|cancel/i });
  await user.click(closeButton);
};

// Search testing utilities
export const performSearch = async (searchTerm) => {
  const user = userEvent.setup();
  const searchInput = screen.getByPlaceholderText(/search/i);
  await user.clear(searchInput);
  await user.type(searchInput, searchTerm);
  
  // Wait for search to complete
  await waitFor(() => {
    expect(searchInput).toHaveValue(searchTerm);
  });
};

// Dropdown testing utilities
export const selectDropdownOption = async (dropdownLabel, optionText) => {
  const user = userEvent.setup();
  const dropdown = screen.getByLabelText(new RegExp(dropdownLabel, 'i'));
  await user.click(dropdown);
  
  const option = screen.getByText(optionText);
  await user.click(option);
};

// Checkbox testing utilities
export const toggleCheckbox = async (checkboxLabel) => {
  const user = userEvent.setup();
  const checkbox = screen.getByLabelText(checkboxLabel);
  await user.click(checkbox);
};

// Date picker testing utilities
export const selectDate = async (dateInputLabel, date) => {
  const user = userEvent.setup();
  const dateInput = screen.getByLabelText(new RegExp(dateInputLabel, 'i'));
  await user.clear(dateInput);
  await user.type(dateInput, date);
};

// File upload testing utilities
export const uploadFile = async (inputLabel, file) => {
  const user = userEvent.setup();
  const fileInput = screen.getByLabelText(new RegExp(inputLabel, 'i'));
  await user.upload(fileInput, file);
};

// Loading state testing
export const expectLoadingState = () => {
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
};

export const expectNoLoadingState = () => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
};

// Error state testing
export const expectErrorState = (errorMessage) => {
  expect(screen.getByText(errorMessage)).toBeInTheDocument();
};

// Success state testing
export const expectSuccessState = (successMessage) => {
  expect(screen.getByText(successMessage)).toBeInTheDocument();
};

// Navigation testing
export const expectNavigation = (path) => {
  expect(window.location.pathname).toBe(path);
};

// Mock window.location
export const mockLocation = (path) => {
  delete window.location;
  window.location = {
    pathname: path,
    search: '',
    hash: '',
    href: `http://localhost${path}`,
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn()
  };
};

// Mock window.scrollTo
export const mockScrollTo = () => {
  window.scrollTo = jest.fn();
};

// Mock IntersectionObserver
export const mockIntersectionObserver = () => {
  global.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() { return null; }
    disconnect() { return null; }
    unobserve() { return null; }
  };
};

// Mock ResizeObserver
export const mockResizeObserver = () => {
  global.ResizeObserver = class ResizeObserver {
    constructor() {}
    observe() { return null; }
    disconnect() { return null; }
    unobserve() { return null; }
  };
};

// Test data generators
export const generateTestClient = (overrides = {}) => ({
  _id: `client-${Date.now()}`,
  clientNo: Math.floor(Math.random() * 1000),
  name: 'Test Client',
  alias: 'TC',
  email: 'test@example.com',
  mobile: '9876543210',
  correspondenceAddress: {
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    area: 'Test Area',
    postalCode: '400001',
    landmark: 'Test Landmark'
  },
  permanentAddress: {
    country: 'India',
    state: 'Maharashtra',
    city: 'Mumbai',
    area: 'Test Area',
    postalCode: '400001',
    landmark: 'Test Landmark'
  },
  orders: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const generateTestProduct = (overrides = {}) => ({
  _id: `product-${Date.now()}`,
  name: 'Test Product',
  alias: 'TP',
  productGroupId: 'group-1',
  unitType: 'SQUARE_METER',
  ratePerUnit: 100.00,
  alternateUnits: {
    numberOfItems: 10,
    numberOfUnits: 5
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

// Async testing helpers
export const waitForElementToBeRemoved = async (element) => {
  await waitFor(() => {
    expect(element).not.toBeInTheDocument();
  });
};

export const waitForElementToAppear = async (element) => {
  await waitFor(() => {
    expect(element).toBeInTheDocument();
  });
};

// Snapshot testing helpers
export const expectComponentToMatchSnapshot = (component) => {
  expect(component).toMatchSnapshot();
};

// Accessibility testing helpers
export const expectAccessible = (element) => {
  expect(element).toBeInTheDocument();
  expect(element).toHaveAttribute('aria-label');
};

// Performance testing helpers
export const measureRenderTime = async (renderFunction) => {
  const startTime = performance.now();
  await renderFunction();
  const endTime = performance.now();
  return endTime - startTime;
}; 