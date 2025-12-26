import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';

// Build config based on environment
const buildConfig = () => {
  const mongoUrl = process.env.MONGODB_URL;
  const dbName = process.env.MONGODB_DATABASE || 'immo-db';

  // Production/Railway: append database name to URL if not present
  if (mongoUrl && process.env.NODE_ENV === 'production') {
    // Check if URL already has a database path
    const url = new URL(mongoUrl);
    if (!url.pathname || url.pathname === '/') {
      // Append database name to the connection string
      url.pathname = `/${dbName}`;
    }

    return {
      name: 'immo-dataSource',
      connector: 'mongodb',
      url: url.toString(),
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Connection pooling for better performance
      poolSize: 10,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
      heartbeatFrequencyMS: 10000,
      // Auto-reconnect settings
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000
    };
  }

  // Local development: use simple connection
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
