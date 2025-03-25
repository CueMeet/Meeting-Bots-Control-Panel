export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    allowedOrigins: process.env.CORS_ALLOWED_ORIGINS || '*',
  },
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
});
