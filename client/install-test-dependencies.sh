#!/bin/bash

# Install Testing Dependencies
echo "Installing testing dependencies..."

# Core testing libraries
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event

# MSW for API mocking
npm install --save-dev msw

# Babel dependencies for Jest
npm install --save-dev @babel/core @babel/preset-env @babel/preset-react @babel/plugin-transform-runtime babel-jest

# Jest plugins
npm install --save-dev jest-watch-typeahead

# Identity obj proxy for CSS modules
npm install --save-dev identity-obj-proxy

# Additional utilities
npm install --save-dev @testing-library/dom

echo "Testing dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm test' to start testing"
echo "2. Run 'npm test -- --coverage' to see coverage report"
echo "3. Check TESTING_GUIDE.md for detailed instructions"
echo ""
echo "Available test commands:"
echo "- npm test                    # Run all tests"
echo "- npm test -- --watch        # Run tests in watch mode"
echo "- npm test -- --coverage     # Run tests with coverage"
echo "- npm test -- --testPathPattern=client    # Run only client tests"
echo "- npm test -- --testPathPattern=product   # Run only product tests"
echo "- npm test -- --testPathPattern=order     # Run only order tests"
echo "- npm test -- --testPathPattern=debts     # Run only debts tests"
echo "- npm test -- --testPathPattern=productGroups # Run only product group tests" 