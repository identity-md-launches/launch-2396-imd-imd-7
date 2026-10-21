import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Normal installs resolve locally. The override supports an isolated tool directory.
const require = createRequire(resolve(process.env.IMD_TEST_DEPENDENCIES || '.', 'package.json'));
export const { chromium, webkit } = require('playwright');
export const { default: AxeBuilder } = require('@axe-core/playwright');
