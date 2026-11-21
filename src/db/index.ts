import tls from 'node:tls';
import { drizzle } from 'drizzle-orm/neon-http';
import { relations } from './relations';

// Development only: also trust the operating system's certificate store, so
// the database connection works on networks that inspect HTTPS traffic with
// their own certificate (otherwise: SELF_SIGNED_CERT_IN_CHAIN).
// (These APIs exist in Node 22.19+/24.5+, newer than the project's @types/node.)
const nodeTls = tls as typeof tls & {
  setDefaultCACertificates?: (certs: string[]) => void;
  getCACertificates?: (type: 'default' | 'system') => string[];
};
if (
  process.env.NODE_ENV !== 'production' &&
  nodeTls.setDefaultCACertificates &&
  nodeTls.getCACertificates
) {
  nodeTls.setDefaultCACertificates([
    ...nodeTls.getCACertificates('default'),
    ...nodeTls.getCACertificates('system'),
  ]);
}

const db = drizzle(process.env.DATABASE_URL!, { relations });

export { db };
