# Agent Flow Integration Tests

This directory contains integration tests for the multi-agent planning system.

## Test Structure

```
__tests__/
├── agent-flow.test.ts      # Full integration test of all agents
├── organizing-agent.test.ts # Unit tests for Organizing Agent
├── test-utils.ts           # Mock data and helper functions
└── run-tests.ts            # Simple test runner (for non-Jest environments)
```

## Running Tests

### Prerequisites

First, install the test dependencies:

```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-jsdom
```

### Run All Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Run Agent Tests Only

```bash
# Run all agent tests
npm run test:agents

# Run integration test only
npm run test:integration
```

### Run Specific Test File

```bash
# Run a specific test file
npx jest src/lib/planning/agents/__tests__/organizing-agent.test.ts
```

## Test Coverage

The tests cover:

1. **Agent Flow Integration** (`agent-flow.test.ts`)
   - Complete dialogue → approval → execution flow
   - Agent communication and data passing
   - Error handling and recovery
   - Session management

2. **Individual Agent Tests**
   - Organizing Agent dialogue and execution phases
   - Selection Agent task prioritization
   - Editing Agent JSON generation

3. **Mock Responses**
   - All agent responses are mocked to avoid API calls
   - Realistic data structures matching production

## Mock Data

The `test-utils.ts` file provides:

- Mock family members (Theobald family)
- Mock tasks (school and household)
- Mock objectives
- Mock recurring tasks
- Helper functions for creating test data

## Environment Variables

Tests use mock environment variables set in `jest.setup.js`:

```javascript
process.env.USE_NEW_PLANNING_SYSTEM = 'true'
process.env.ORGANIZING_AGENT_MODEL = 'claude-test-model'
process.env.SELECTION_AGENT_MODEL = 'claude-test-model'
process.env.EDITING_AGENT_MODEL = 'claude-test-model'
```

## Writing New Tests

To add a new test:

1. Create a new test file in `__tests__/` directory
2. Import necessary mocks from `test-utils.ts`
3. Mock the Anthropic SDK at the top of the file:

```typescript
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn()
    }
  }))
}))
```

4. Write your test cases using Jest's `describe` and `it` blocks

## Debugging Tests

To debug a failing test:

1. Run with verbose output:
   ```bash
   npx jest --verbose --no-coverage path/to/test.ts
   ```

2. Add console.log statements (they're mocked but you can temporarily unmock them)

3. Use Jest's `--detectOpenHandles` flag to find async issues:
   ```bash
   npx jest --detectOpenHandles
   ```

## CI/CD Integration

To run tests in CI:

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    npm ci
    npm run test:coverage
```

## Common Issues

1. **Timeout Errors**: Increase Jest timeout in `jest.setup.js`
2. **Module Resolution**: Check `moduleNameMapper` in `jest.config.js`
3. **TypeScript Errors**: Ensure `ts-jest` is properly configured