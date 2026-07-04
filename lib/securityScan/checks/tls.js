import tls from "node:tls";

function connectTls(host, options = {}) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false, // vi vil inspisere, ikke avvise
        timeout: 6000,
        ...options,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const result = {
          ok: true,
          protocol: socket.getProtocol(), // f.eks. "TLSv1.3"
          authorized: socket.authorized,
          validTo: cert?.valid_to || null,
          validFrom: cert?.valid_from || null,
          issuer: cert?.issuer?.O || cert?.issuer?.CN || null,
          subject: cert?.subject?.CN || null,
        };
        socket.destroy();
        resolve(result);
      }
    );
    socket.on("error", () => resolve({ ok: false }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ ok: false });
    });
  });
}

// Sjekker om serveren fortsatt aksepterer utdaterte protokoller
async function acceptsLegacy(host, version) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
        port: 443,
        servername: host,
        rejectUnauthorized: false,
        minVersion: version,
        maxVersion: version,
        timeout: 5000,
      },
      () => {
        socket.destroy();
        resolve(true);
      }
    );
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function checkTls(host) {
  const main = await connectTls(host);
  if (!main.ok) return { ok: false };

  const [tls10, tls11] = await Promise.all([
    acceptsLegacy(host, "TLSv1"),
    acceptsLegacy(host, "TLSv1.1"),
  ]);

  let daysToExpiry = null;
  if (main.validTo) {
    daysToExpiry = Math.floor(
      (new Date(main.validTo).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
  }

  return {
    ok: true,
    protocol: main.protocol,
    certValid: main.authorized,
    issuer: main.issuer,
    daysToExpiry,
    acceptsTls10: tls10,
    acceptsTls11: tls11,
  };
}
