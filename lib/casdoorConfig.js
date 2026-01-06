const sdkConfig = {
  serverUrl: process.env.CASDOOR_SERVER_URL,
  clientId: process.env.CASDOOR_CLIENT_ID,
  clientSecret: process.env.CASDOOR_CLIENT_SECRET,
  organizationName: process.env.CASDOOR_ORGANIZATION_NAME,
  appName: process.env.CASDOOR_APP_NAME,
  redirectPath: "/api/casdoor/callback",
  appUrl: process.env.NEXT_PUBLIC_APP_URL
};

export const clientSdkConfig = {
  serverUrl: sdkConfig.serverUrl,
  clientId: sdkConfig.clientId,
  organizationName: sdkConfig.organizationName,
  appName: sdkConfig.appName,
  redirectPath: sdkConfig.redirectPath,
};


export default sdkConfig;
