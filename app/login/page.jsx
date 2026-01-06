"use client";
import { useEffect, useState } from "react";
import { clientSdkConfig } from "@/lib/casdoorConfig";

export default function LoginPage() {
  const [casdoorSDK, setCasdoorSDK] = useState(null);

  useEffect(() => {
    import("casdoor-js-sdk").then((SdkModule) => {
      const Sdk = SdkModule.default;
      const sdk = new Sdk(clientSdkConfig);
      setCasdoorSDK(sdk);
      window.location.href = sdk.getSigninUrl();
    });
  }, []);

  return (
    <section className="container-default py-24">
      <h1 className="text-2xl font-semibold">Omdirigerer til innlogging...</h1>
      <p className="text-white/70 mt-2">Vennligst vent mens vi sender deg til Casdoor.</p>
    </section>
  );
}
