import '@testing-library/jest-dom';
import { vi } from 'vitest';

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();
