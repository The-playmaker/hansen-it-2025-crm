"use client";
import { useEffect, useState } from "react";
import { clientSdkConfig } from "@/lib/casdoorConfig";

export default function LoginPage() {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clientSdkConfig.serverUrl || !clientSdkConfig.clientId) {
      setError("Casdoor-konfigurasjonen mangler. Vennligst kontakt support.");
      return;
    }

    import("casdoor-js-sdk").then((SdkModule) => {
      const Sdk = SdkModule.default;
      const sdk = new Sdk(clientSdkConfig);
      window.location.href = sdk.getSigninUrl();
    });
  }, []);

  if (error) {
    return (
      <section className="container-default py-24">
        <h1 className="text-2xl font-semibold text-red-500">Konfigurasjonsfeil</h1>
        <p className="text-white/70 mt-2">{error}</p>
      </section>
    );
  }

  return (
    <section className="container-default py-24">
      <h1 className="text-2xl font-semibold">Omdirigerer til innlogging...</h1>
      <p className="text-white/70 mt-2">Vennligst vent mens vi sender deg til Casdoor.</p>
    </section>
  );
}
