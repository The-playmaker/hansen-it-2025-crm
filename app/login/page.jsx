"use client";
import { useEffect, useState } from "react";
import { clientSdkConfig } from "@/lib/casdoorConfig";

export default function LoginPage() {
  const [casdoorSDK, setCasdoorSDK] = useState(null);

  useEffect(() => {
    import("casdoor-js-sdk").then((SdkModule) => {
      const Sdk = SdkModule.default;
      setCasdoorSDK(new Sdk(clientSdkConfig));
    });
  }, []);

  const login = () => {
    if (casdoorSDK) {
      window.location.href = casdoorSDK.getSigninUrl();
    }
  };

  return (
    <section className="container-default py-24">
      <h1 className="text-2xl font-semibold">Logg inn</h1>
      <p className="text-white/70 mt-2">Bruk Casdoor-kontoen din.</p>
      <button
        onClick={login}
        disabled={!casdoorSDK}
        className="mt-6 px-5 py-2 bg-white text-black rounded disabled:opacity-50"
      >
        Logg inn med Casdoor
      </button>
    </section>
  );
}
