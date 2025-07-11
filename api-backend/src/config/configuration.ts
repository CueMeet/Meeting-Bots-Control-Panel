export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '*',
  },
  frontendUrl: process.env.CUSTOMER_PORTAL_FRONTEND_URL,
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },
  grpc: {
    workerBackendUrl: process.env.WORKER_BACKEND_GRPC_URL,
  },
  aws: {
    accessKey: process.env.AWS_ACCESS_KEY,
    secretKey: process.env.AWS_SECRET_KEY,
    bucketRegion: process.env.AWS_BUCKET_REGION,
    ecsClusterName: process.env.AWS_ECS_CLUSTER_NAME,
    securityGroup: process.env.AWS_SECURITY_GROUP,
    vpsSubnet: process.env.AWS_VPS_SUBNET,
    meetingBotBucketName: process.env.AWS_MEETING_BOT_BUCKET_NAME,
    ecsTaskDefinitionGoogle: process.env.ECS_TASK_DEFINITION_GOOGLE,
    ecsContainerNameGoogle: process.env.ECS_CONTAINER_NAME_GOOGLE,
    ecsTaskDefinitionTeams: process.env.ECS_TASK_DEFINITION_TEAMS,
    ecsContainerNameTeams: process.env.ECS_CONTAINER_NAME_TEAMS,
    ecsTaskDefinitionZoom: process.env.ECS_TASK_DEFINITION_ZOOM,
    ecsContainerNameZoom: process.env.ECS_CONTAINER_NAME_ZOOM,
  },
  bot: {
    meetingBotRetryCount:
      parseInt(process.env.MEETING_BOT_RETRY_COUNT, 10) || 2,
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
  },
  // ZITADEL OAuth Configuration
  zitadel: {
    issuer: process.env.ZITADEL_ISSUER,
    clientId: process.env.ZITADEL_CLIENT_ID,
    clientSecret: process.env.ZITADEL_CLIENT_SECRET,
    redirectUri: process.env.ZITADEL_REDIRECT_URI,
    postLogoutRedirectUri: process.env.ZITADEL_POST_LOGOUT_REDIRECT_URI,
    scope: process.env.ZITADEL_SCOPE || 'openid profile email',
    organizationId: process.env.ZITADEL_ORGANIZATION_ID,
    projectId: process.env.ZITADEL_PROJECT_ID,
    apiUrl: process.env.ZITADEL_API_URL,
  },
  // Customer Portal JWT Configuration
  customerJwt: {
    secret: process.env.CUSTOMER_JWT_SECRET,
    expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.CUSTOMER_JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.CUSTOMER_JWT_ISSUER || 'cuemeet-customer-portal',
    audience: process.env.CUSTOMER_JWT_AUDIENCE || 'cuemeet-customers',
  },
  // Customer Portal Configuration
  customerPortal: {
    frontendUrl: process.env.CUSTOMER_PORTAL_FRONTEND_URL,
  },
  // LavaPayments Configuration
  lavapayments: {
    secretKey: process.env.LAVAPAYMENTS_SECRET_KEY,
    baseUrl:
      process.env.LAVAPAYMENTS_BASE_URL || 'https://api.lavapayments.com/v1',
    webhookSecret: process.env.LAVAPAYMENTS_WEBHOOK_SECRET,
    productSecret: process.env.LAVA_PRODUCT_SECRET,
  },
});
