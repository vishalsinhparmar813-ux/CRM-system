# Testing Documentation

## Overview
This document outlines the testing strategy for the client, product, and order management system. We use Jest and React Testing Library for comprehensive testing coverage.

## Testing Structure

```
src/tests/
├── README.md                 # This file
├── setup.js                  # Test setup configuration
├── utils/                    # Test utilities and helpers
│   ├── testUtils.js         # Common test utilities
│   ├── mockData.js          # Mock data for tests
│   └── apiMocks.js          # API response mocks
├── components/               # Component tests
│   ├── ui/                  # UI component tests
│   └── forms/               # Form component tests
├── pages/                   # Page component tests
├── hooks/                   # Custom hook tests
├── context/                 # Context provider tests
├── utils/                   # Utility function tests
└── integration/             # Integration tests
```

## Testing Tools

- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing utilities
- **MSW (Mock Service Worker)**: API mocking
- **@testing-library/jest-dom**: Custom Jest matchers
- **@testing-library/user-event**: User interaction simulation

## Test Categories

### 1. Unit Tests
- Individual functions and components
- Pure logic testing
- Isolated component behavior

### 2. Integration Tests
- Component interactions
- API integration
- User workflows

### 3. E2E Tests (Future)
- Complete user journeys
- Cross-browser testing
- Performance testing

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern=client

# Run tests matching pattern
npm test -- --testNamePattern="should create client"
```

## Test Naming Convention

- **Unit Tests**: `[function/component].test.js`
- **Integration Tests**: `[feature].integration.test.js`
- **Test Descriptions**: Use descriptive names that explain the expected behavior

## Mock Data Strategy

- Centralized mock data in `mockData.js`
- Realistic data that matches production schema
- Separate mocks for different scenarios (success, error, empty)

## Coverage Goals

- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

## Best Practices

1. **Arrange-Act-Assert**: Structure tests clearly
2. **Test Behavior, Not Implementation**: Focus on what users see
3. **Use Descriptive Names**: Test names should explain the scenario
4. **Mock External Dependencies**: Don't test third-party libraries
5. **Test Error Cases**: Include error scenarios and edge cases
6. **Keep Tests Fast**: Avoid slow operations in tests
7. **Maintain Test Data**: Keep mock data up to date 