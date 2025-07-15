# Testing Guide

## Overview
This guide explains how to run tests, understand test coverage, and maintain the testing suite for the client, product, and order management system.

## Quick Start

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test -- --watch
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test Files
```bash
# Run only client tests
npm test -- --testPathPattern=client

# Run only product tests
npm test -- --testPathPattern=product

# Run only order tests
npm test -- --testPathPattern=order

# Run only debts tests
npm test -- --testPathPattern=debts

# Run only product group tests
npm test -- --testPathPattern=productGroups
```

### Run Tests by Name Pattern
```bash
# Run tests containing "should create"
npm test -- --testNamePattern="should create"

# Run tests containing "validation"
npm test -- --testNamePattern="validation"
```

## Test Structure

### Test Files
- `src/tests/pages/client.test.js` - Client management tests
- `src/tests/pages/product.test.js` - Product management tests
- `src/tests/pages/order.test.js` - Order management tests
- `src/tests/pages/debts.test.js` - Debts list tests
- `src/tests/pages/productGroups.test.js` - Product group tests

### Test Utilities
- `src/tests/utils/testUtils.js` - Common test utilities
- `src/tests/utils/mockData.js` - Mock data for tests
- `src/tests/utils/apiMocks.js` - API mocking with MSW

### Test Setup
- `src/tests/setup.js` - Jest setup configuration
- `jest.config.js` - Jest configuration
- `babel.config.js` - Babel configuration for tests

## Test Categories

### 1. Unit Tests
Test individual functions and components in isolation.

**Examples:**
- Form validation functions
- Utility functions
- Component rendering
- Hook behavior

### 2. Integration Tests
Test component interactions and API integration.

**Examples:**
- Form submission with API calls
- Component state management
- User interactions
- Data flow between components

### 3. End-to-End Workflows
Test complete user journeys.

**Examples:**
- Creating a client → adding products → creating orders
- Managing debts and payments
- Product group management

## Test Coverage

### Client Management (client.test.js)
- ✅ Client list display
- ✅ Client search (name, alias, mobile)
- ✅ Add client form validation
- ✅ Edit client functionality
- ✅ Delete client with confirmation
- ✅ Address handling (same address checkbox)
- ✅ Form validation edge cases
- ✅ Accessibility features
- ✅ Performance with large datasets

### Product Management (product.test.js)
- ✅ Product list display
- ✅ Product search (name, alias)
- ✅ Add product form validation
- ✅ Product group integration
- ✅ Unit type handling (including SET)
- ✅ Alternate units validation
- ✅ Edit product functionality
- ✅ Delete product with confirmation
- ✅ Form validation edge cases
- ✅ Accessibility features
- ✅ Performance with large datasets

### Order Management (order.test.js)
- ✅ Order list display
- ✅ Add order form validation
- ✅ Automatic unit type setting
- ✅ Amount calculation
- ✅ Client and product dropdowns
- ✅ Date validation
- ✅ Order status management
- ✅ Edit order functionality
- ✅ Delete order with confirmation
- ✅ Form validation edge cases
- ✅ Accessibility features
- ✅ Performance with large datasets

### Debts List (debts.test.js)
- ✅ Debts list display
- ✅ Debt calculation accuracy
- ✅ Summary statistics
- ✅ Search and filtering
- ✅ Export functionality (PDF/Excel)
- ✅ Sorting functionality
- ✅ Pagination
- ✅ Client details navigation
- ✅ Performance with large datasets

### Product Groups (productGroups.test.js)
- ✅ Product group list display
- ✅ Add product group form validation
- ✅ Edit product group functionality
- ✅ Delete product group with confirmation
- ✅ Status management (active/inactive)
- ✅ Product count display
- ✅ Form validation edge cases
- ✅ Accessibility features
- ✅ Performance with large datasets

## Test Utilities

### renderWithProviders
Custom render function that wraps components with necessary providers:
- Redux store
- Admin context
- Router
- Theme provider

### Form Testing
- `fillForm()` - Fill form fields with data
- `submitForm()` - Submit forms
- `expectValidationError()` - Check for validation errors
- `expectNoValidationError()` - Verify no validation errors

### API Testing
- `waitForApiCall()` - Wait for API calls to complete
- `expectApiCallWithData()` - Verify API call data
- `expectToastSuccess()` - Check for success messages
- `expectToastError()` - Check for error messages

### UI Testing
- `expectTableHeaders()` - Verify table headers
- `expectTableRow()` - Verify table row data
- `openModal()` - Open modals
- `closeModal()` - Close modals
- `performSearch()` - Perform search operations

## Mock Data

### Client Data
- Sample clients with addresses
- Various scenarios (active, inactive, with/without orders)

### Product Data
- Products with different unit types
- Products with/without alternate units
- Products in different groups

### Order Data
- Orders with different statuses
- Orders with/without transactions
- Orders with different amounts

### Transaction Data
- Payment transactions
- Different payment methods
- Various amounts and statuses

## API Mocking

### MSW (Mock Service Worker)
- Intercepts HTTP requests during tests
- Returns mock responses
- Simulates different scenarios (success, error, network issues)

### Mock Scenarios
- Successful API calls
- Validation errors
- Network errors
- Timeout errors
- Empty responses

## Best Practices

### 1. Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Data
- Use realistic mock data
- Test edge cases and error scenarios
- Keep mock data up to date with schema changes

### 3. Test Isolation
- Each test should be independent
- Clean up after each test
- Don't rely on test execution order

### 4. Performance
- Test with realistic data volumes
- Monitor test execution time
- Optimize slow tests

### 5. Accessibility
- Test keyboard navigation
- Verify ARIA labels
- Check screen reader compatibility

## Debugging Tests

### Common Issues

#### 1. Test Timeouts
```javascript
// Increase timeout for slow tests
it('should handle large dataset', async () => {
  // ... test code
}, 10000); // 10 second timeout
```

#### 2. Async Operations
```javascript
// Always wait for async operations
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

#### 3. Mock Data Issues
```javascript
// Verify mock data is correct
console.log('Mock data:', mockData);
```

#### 4. API Mock Issues
```javascript
// Check if MSW is intercepting requests
server.use(
  rest.get('/api/test', (req, res, ctx) => {
    console.log('API call intercepted');
    return res(ctx.json({ data: 'test' }));
  })
);
```

### Debug Commands
```bash
# Run tests with verbose output
npm test -- --verbose

# Run tests with console output
npm test -- --silent=false

# Run single test file with debugging
npm test -- --testPathPattern=client --verbose --silent=false
```

## Continuous Integration

### GitHub Actions
Tests are automatically run on:
- Pull requests
- Push to main branch
- Scheduled runs

### Coverage Requirements
- Statements: 90%
- Branches: 85%
- Functions: 90%
- Lines: 90%

### Pre-commit Hooks
- Run tests before commit
- Check coverage thresholds
- Lint code

## Adding New Tests

### 1. Create Test File
```javascript
// src/tests/pages/newFeature.test.js
import React from 'react';
import { renderWithProviders } from '../utils/testUtils';

describe('New Feature', () => {
  it('should work correctly', () => {
    // Test implementation
  });
});
```

### 2. Add Mock Data
```javascript
// src/tests/utils/mockData.js
export const mockNewFeatureData = {
  // Add mock data
};
```

### 3. Add API Mocks
```javascript
// src/tests/utils/apiMocks.js
rest.get('/api/new-feature', (req, res, ctx) => {
  return res(ctx.json(mockNewFeatureData));
});
```

### 4. Update Test Utilities
```javascript
// src/tests/utils/testUtils.js
export const newTestUtility = () => {
  // Add new utility function
};
```

## Performance Testing

### Load Testing
```javascript
it('should handle 1000 records efficiently', async () => {
  const startTime = performance.now();
  
  // Render component with large dataset
  
  const endTime = performance.now();
  const renderTime = endTime - startTime;
  
  expect(renderTime).toBeLessThan(2000); // 2 seconds
});
```

### Memory Testing
```javascript
it('should not cause memory leaks', () => {
  const initialMemory = performance.memory?.usedJSHeapSize || 0;
  
  // Perform operations
  
  const finalMemory = performance.memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;
  
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

## Troubleshooting

### Common Problems

#### 1. Tests Failing Intermittently
- Check for race conditions
- Ensure proper async handling
- Verify mock data consistency

#### 2. Coverage Not Meeting Thresholds
- Add tests for uncovered code paths
- Test error scenarios
- Test edge cases

#### 3. Slow Test Execution
- Optimize mock data
- Reduce unnecessary API calls
- Use more efficient selectors

#### 4. MSW Not Working
- Check MSW setup in setup.js
- Verify API endpoints match
- Ensure MSW is running in test environment

### Getting Help
- Check test documentation
- Review existing test examples
- Consult team members
- Check Jest and React Testing Library documentation

## Resources

### Documentation
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Documentation](https://mswjs.io/docs/)

### Tools
- Jest DevTools (browser extension)
- React Testing Library DevTools
- Coverage reports (HTML format)

### Best Practices
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Accessibility Testing](https://testing-library.com/docs/guiding-principles)
- [Performance Testing](https://web.dev/performance-testing/) 