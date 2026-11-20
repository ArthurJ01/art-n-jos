import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Remove what a test rendered before the next one runs. Testing Library only
// does this by itself when Vitest's global `afterEach` is enabled, which it isn't here.
afterEach(cleanup);
