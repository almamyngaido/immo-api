import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

// Build config based on environment
const buildConfig = () => {
  // Debug: print all MongoDB-related env vars
  console.log('[MongoDB Config] === Environment Variables Debug ===');
  console.log('[MongoDB Config] MONGODB_URL:', process.env.MONGODB_URL);
  console.log('[MongoDB Config] MONGO_URL:', process.env.MONGO_URL);
  console.log('[MongoDB Config] DATABASE_URL:', process.env.DATABASE_URL);
  console.log('[MongoDB Config] MONGODB_DATABASE:', process.env.MONGODB_DATABASE);
  console.log('[MongoDB Config] NODE_ENV:', process.env.NODE_ENV);
  console.log('[MongoDB Config] ===================================');

  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URL || process.env.DATABASE_URL;
  const dbName = process.env.MONGODB_DATABASE || 'immo-db';

  console.log('[MongoDB Config] Selected URL exists:', !!mongoUrl);
  console.log('[MongoDB Config] Database name:', dbName);

  // If MONGODB_URL is provided (Railway/production), use production config
  if (mongoUrl && !mongoUrl.includes('127.0.0.1') && !mongoUrl.includes('localhost')) {
    // Check if URL already has a database path
    const url = new URL(mongoUrl);
    if (!url.pathname || url.pathname === '/') {
      // Append database name to the connection string
      url.pathname = `/${dbName}`;
    }

    const finalUrl = url.toString();
    console.log('[MongoDB Config] Using PRODUCTION config');
    console.log('[MongoDB Config] URL host:', url.hostname);
    console.log('[MongoDB Config] URL port:', url.port);
    console.log('[MongoDB Config] URL pathname:', url.pathname);

    return {
      name: 'immo-dataSource',
      connector: 'mongodb',
      url: finalUrl,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Connection pooling for better performance
      poolSize: 10,
      socketTimeoutMS: 60000,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      // Auto-reconnect settings
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000
    };
  }

  // Local development: use simple connection
  console.log('[MongoDB Config] Using LOCAL config');
  return {
    name: 'immo-dataSource',
    connector: 'mongodb',
    url: mongoUrl || 'mongodb://127.0.0.1:27017',
    database: dbName,
    useNewUrlParser: true,
    useUnifiedTopology: true
  };
};

const config = buildConfig();

// Observe application's life cycle to disconnect the datasource when
// application is stopped. This allows the application to be shut down
// gracefully. The `stop()` method is inherited from `juggler.DataSource`.
// Learn more at https://loopback.io/doc/en/lb4/Life-cycle.html
@lifeCycleObserver('datasource')
export class ImmoApiDataSource extends juggler.DataSource
  implements LifeCycleObserver {
  static dataSourceName = 'immoApi';
  static readonly defaultConfig = config;

  constructor(
    @inject('datasources.config.immoApi', {optional: true})
    dsConfig: object = config,
  ) {
    super(dsConfig);
  }
}
