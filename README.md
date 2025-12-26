# immo-api

This application is generated using [LoopBack 4 CLI](https://loopback.io/doc/en/lb4/Command-line-interface.html) with the
[initial project layout](https://loopback.io/doc/en/lb4/Loopback-application-layout.html).

## Install dependencies

By default, dependencies were installed when this application was generated.
Whenever dependencies in `package.json` are changed, run the following command:

```sh
npm install
```

To only install resolved dependencies in `package-lock.json`:

```sh
npm ci
```

## Run the application

```sh
npm start
```

You can also run `node .` to skip the build step.

Open http://127.0.0.1:3000 in your browser.

## Rebuild the project

To incrementally build the project:

```sh
npm run build
```

To force a full build by cleaning up cached artifacts:

```sh
npm run rebuild
```

## Fix code style and formatting issues

```sh
npm run lint
```

To automatically fix such issues:

```sh
npm run lint:fix
```

## Other useful commands

- `npm run migrate`: Migrate database schemas for models
- `npm run openapi-spec`: Generate OpenAPI spec into a file
- `npm run docker:build`: Build a Docker image for this application
- `npm run docker:run`: Run this application inside a Docker container

## Tests

```sh
npm test
```

## Deploy to Railway

This application is configured for easy deployment on Railway.

### Prerequisites

1. A Railway account (https://railway.app)
2. A MongoDB database (you can add one from Railway's database services)

### Deployment Steps

1. **Push your code to GitHub** (if not already done)

2. **Create a new project on Railway**
   - Go to https://railway.app
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add MongoDB Database**
   - In your Railway project, click "New"
   - Select "Database" > "Add MongoDB"
   - Railway will automatically create a MongoDB instance and provide the connection URL

4. **Configure Environment Variables**
   - Go to your service's "Variables" tab
   - Add the following environment variables:

   ```
   NODE_ENV=production
   MONGODB_URL=${{MongoDB.MONGO_URL}}
   MONGODB_DATABASE=immo-db
   JWT_SECRET=your-super-secret-jwt-key-change-this
   JWT_EXPIRY=24h
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-gmail-app-password
   FRONTEND_URL=https://your-frontend-url.com
   ```

   Note: `${{MongoDB.MONGO_URL}}` will be automatically replaced by Railway with your MongoDB connection string.

5. **Deploy**
   - Railway will automatically build and deploy your application
   - The build process will run `npm install` and `npm run build`
   - The start command `npm start` will launch your application

6. **Access your API**
   - Once deployed, Railway will provide you with a public URL
   - Your API will be available at `https://your-app.up.railway.app`

### Environment Variables Reference

See `.env.example` for all required environment variables and their descriptions.

### Troubleshooting

- If the build fails, check the build logs in Railway's dashboard
- Ensure all required environment variables are set
- Make sure your MongoDB connection string is correct
- Check that your JWT_SECRET is set to a secure random string

## What's next

Please check out [LoopBack 4 documentation](https://loopback.io/doc/en/lb4/) to
understand how you can continue to add features to this application.

[![LoopBack](https://github.com/loopbackio/loopback-next/raw/master/docs/site/imgs/branding/Powered-by-LoopBack-Badge-(blue)-@2x.png)](http://loopback.io/)
