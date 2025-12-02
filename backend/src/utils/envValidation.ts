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
    errors.push(
      'SESSION_SECRET is required in production. Please set it in your environment variables.\n' +
        '   For Render: Go to your service settings > Environment > Add SESSION_SECRET\n' +
        '   Generate a secure secret: openssl rand -base64 32',
    );
  }

  // Warn about weak session secret
  if (process.env.SESSION_SECRET === 'dev_secret_change_me') {
    if (isProduction) {
      errors.push(
        'SESSION_SECRET is set to default value. This is insecure in production!\n' +
          '   Generate a secure secret: openssl rand -base64 32',
      );
    } else {
      console.warn('⚠️  WARNING: SESSION_SECRET is set to default value. Change it in production!');
    }
  }

  // Warn about CORS configuration in production
  if (isProduction && !process.env.CORS_ORIGIN) {
    console.warn('⚠️  WARNING: CORS_ORIGIN is not set in production. This may cause CORS issues.');
  }

  if (errors.length > 0) {
    console.error('❌ Environment validation failed:');
    errors.forEach((error) => console.error(`   - ${error}`));
    console.error('\n💡 Quick fix:');
    console.error('   1. Generate a secure SESSION_SECRET: openssl rand -base64 32');
    console.error('   2. Add it to your environment variables (Render dashboard > Environment)');
    console.error('   3. Redeploy your service\n');
    throw new Error('Environment validation failed. Please check your environment variables.');
  }
}

