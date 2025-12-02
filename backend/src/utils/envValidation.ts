/**
 * Environment variable validation
 * Ensures required environment variables are set
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Validates that required environment variables are set
 */
export function validateEnvironment(): void {
  const errors: string[] = [];

  // In production, require session secret
  if (isProduction && !process.env.SESSION_SECRET) {
    errors.push('SESSION_SECRET is required in production');
  }

  // Warn about weak session secret
  if (process.env.SESSION_SECRET === 'dev_secret_change_me') {
    console.warn('⚠️  WARNING: SESSION_SECRET is set to default value. Change it in production!');
  }

  // Warn about CORS configuration in production
  if (isProduction && !process.env.CORS_ORIGIN) {
    console.warn('⚠️  WARNING: CORS_ORIGIN is not set in production. This may cause CORS issues.');
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach((error) => console.error(`   - ${error}`));
    throw new Error('Environment validation failed. Please check your environment variables.');
  }
}

