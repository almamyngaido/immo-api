import {inject, lifeCycleObserver, LifeCycleObserver} from '@loopback/core';
import {juggler} from '@loopback/repository';


const config = {
  name: 'immo-dataSource',
  connector: 'mongodb',
  url: 'mongodb://127.0.0.1:27017',
  // url: 'mongodb://10.20.1.68:30017', // Your MongoDB connection string
  database: 'immo-db',
  useNewUrlParser: true
};

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
