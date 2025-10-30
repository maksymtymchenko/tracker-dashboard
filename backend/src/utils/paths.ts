import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve the absolute screenshots directory consistently in dev (ts-node) and prod (compiled).
 * Always use `<repo>/backend/screenshots` regardless of `src` or `dist` runtime.
 */
export function getScreenshotsDir(): string {
  // __dirname is backend/src/utils or backend/dist/utils → two levels up is backend/
  const backendRoot = path.resolve(__dirname, '..', '..');
  return path.join(backendRoot, 'screenshots');
}


