import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Clean up test data directory before each test suite
beforeAll(() => {
  const testDataDir = path.join(process.cwd(), 'test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

// Clean up after all tests
afterAll(() => {
  const testDataDir = path.join(process.cwd(), 'test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
});

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';