import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { domainToASCII } from 'node:url';

const ALLOWED_SMTP_PORTS = new Set([25, 465, 587, 2525]);

function ipv4IsPublic(address: string): boolean {
  const [a, b, c] = address.split('.').map(Number);
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c)) return false;
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function parseIpv6Bytes(address: string): number[] | null {
  const lower = address.toLowerCase();
  const halves = lower.split('::');
  if (halves.length > 2) return null;

  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const parts = half.split(':');
    const last = parts[parts.length - 1];
    if (last.includes('.')) {
      if (isIP(last) !== 4) return null;
      const octets = last.split('.').map(Number);
      parts.splice(-1, 1, ((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16));
    }
    if (!parts.every((part) => /^[a-f\d]{1,4}$/.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 16));
  };

  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] || '');
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const groups = [...left, ...Array(missing).fill(0), ...right];
  if (groups.length !== 8) return null;
  return groups.flatMap((group) => [(group >> 8) & 0xff, group & 0xff]);
}

export function isPublicSmtpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4IsPublic(address);
  if (family !== 6 || address.includes('%')) return false;

  const bytes = parseIpv6Bytes(address);
  if (!bytes) return false;
  const allZero = bytes.every((byte) => byte === 0);
  const loopback = bytes.slice(0, 15).every((byte) => byte === 0) && bytes[15] === 1;
  if (allZero || loopback || bytes[0] === 0xff) return false;

  const ipv4Mapped = bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff;
  if (ipv4Mapped) return ipv4IsPublic(bytes.slice(12).join('.'));

  const uniqueLocal = (bytes[0] & 0xfe) === 0xfc;
  const linkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80;
  const globalUnicast = (bytes[0] & 0xe0) === 0x20;
  const ipv6Documentation = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8;
  const ipv6IetfSpecial = bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0 && (bytes[3] & 0xfe) === 0;
  const ipv6SixToFour = bytes[0] === 0x20 && bytes[1] === 0x02;
  const ipv6OldDocumentation = bytes[0] === 0x3f && bytes[1] === 0xff && bytes[2] === 0 && bytes[3] === 0;
  return globalUnicast && !uniqueLocal && !linkLocal && !ipv6Documentation &&
    !ipv6IetfSpecial && !ipv6SixToFour && !ipv6OldDocumentation;
}

export interface ResolvedSmtpTarget {
  address: string;
  servername: string;
}

type SmtpLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const systemLookup: SmtpLookup = (hostname) => lookup(hostname, { all: true, verbatim: true });

export async function resolvePublicSmtpTarget(
  hostInput: string,
  port: number,
  resolver: SmtpLookup = systemLookup
): Promise<ResolvedSmtpTarget | null> {
  if (!ALLOWED_SMTP_PORTS.has(port)) return null;
  const trimmedHost = hostInput.trim();
  if (!trimmedHost || trimmedHost !== hostInput || isIP(trimmedHost) !== 0) return null;

  const hostname = domainToASCII(trimmedHost.replace(/\.$/, '').toLowerCase());
  if (
    !hostname || hostname.length > 253 ||
    !hostname.split('.').every((label) => label.length > 0 && label.length <= 63 &&
      /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(label))
  ) {
    return null;
  }

  try {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const addresses = await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('DNS timeout')), 4000);
      }),
    ]).finally(() => clearTimeout(timeout));
    if (addresses.length === 0 || addresses.some(({ address }) => !isPublicSmtpAddress(address))) {
      return null;
    }
    return { address: addresses[0].address, servername: hostname };
  } catch {
    return null;
  }
}
