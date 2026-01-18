const sdkConfig = {
  serverUrl: process.env.NEXT_PUBLIC_CASDOOR_SERVER_URL,
  clientId: process.env.NEXT_PUBLIC_CASDOOR_CLIENT_ID,
  clientSecret: process.env.CASDOOR_CLIENT_SECRET,
  organizationName: process.env.NEXT_PUBLIC_CASDOOR_ORGANIZATION_NAME,
  appName: process.env.NEXT_PUBLIC_CASDOOR_APP_NAME,
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
