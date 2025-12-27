
import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

// Build config based on environment
const buildConfig = () => {
  // Debug: print all MongoDB-related env vars
  console.log('[MongoDB Config] === Environment Variables Debug ===');
  console.log('[MongoDB Config] MONGO_URL exists:', !!process.env.MONGO_URL);
  console.log('[MongoDB Config] MONGOHOST:', process.env.MONGOHOST);
  console.log('[MongoDB Config] MONGOPORT:', process.env.MONGOPORT);
  console.log('[MongoDB Config] MONGOUSER:', process.env.MONGOUSER);
  console.log('[MongoDB Config] NODE_ENV:', process.env.NODE_ENV);
  console.log('[MongoDB Config] ===================================');

  // Railway provides MONGO_URL as the complete connection string
  const mongoUrl = process.env.MONGO_URL;

  // If MONGO_URL is provided (Railway/production)
  if (mongoUrl) {
    console.log('[MongoDB Config] Using PRODUCTION config with MONGO_URL');

    try {
      const url = new URL(mongoUrl);
      console.log('[MongoDB Config] URL host:', url.hostname);
      console.log('[MongoDB Config] URL port:', url.port);
      console.log('[MongoDB Config] URL pathname:', url.pathname);
      console.log('[MongoDB Config] URL has auth:', url.username ? 'Yes' : 'No');
    } catch (e) {
      console.error('[MongoDB Config] Error parsing URL:', e);
    }

    return {
      name: 'immo-dataSource',
      connector: 'mongodb',
      url: mongoUrl,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Connection pooling for better performance
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 60000,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      maxIdleTimeMS: 30000,
      // Important for Railway MongoDB authentication
      authSource: 'admin',
      retryWrites: true,
      w: 'majority'
    };
  }

  // Local development: use simple connection
  console.log('[MongoDB Config] Using LOCAL config');
  return {
    name: 'immo-dataSource',
    connector: 'mongodb',
    url: 'mongodb://127.0.0.1:27017/immo-db',
    useNewUrlParser: true,
    useUnifiedTopology: true
  };
};

const config = buildConfig();

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
