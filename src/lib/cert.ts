import tls from "node:tls";

/** Reads a site's TLS certificate (no attack traffic: one normal handshake). */
export function certInfo(host: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const sock = tls.connect({ host, port: 443, servername: host, timeout: 8000, rejectUnauthorized: false }, () => {
      const c = sock.getPeerCertificate();
      const validTo = c.valid_to ? new Date(c.valid_to) : null;
      resolve({
        valid: sock.authorized,
        error: sock.authorizationError ? String(sock.authorizationError) : null,
        protocol: sock.getProtocol(),
        issuer: c.issuer?.O || c.issuer?.CN || null,
        subject: c.subject?.CN || null,
        validFrom: c.valid_from || null,
        validTo: c.valid_to || null,
        daysLeft: validTo ? Math.round((validTo.getTime() - Date.now()) / 86400000) : null,
        altNames: (c.subjectaltname || "").split(", ").slice(0, 10),
      });
      sock.end();
    });
    sock.on("error", (e) => resolve({ valid: false, error: e.message }));
    sock.on("timeout", () => { sock.destroy(); resolve({ valid: false, error: "timeout" }); });
  });
}
