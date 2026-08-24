import { URL } from 'url';
import net from 'net';

/**
 * SSRF Guard Utility
 * Ensures backend requests only target valid external public HTTP/HTTPS destinations.
 * Blocks private IP subnets, loopbacks, link-local, cloud metadata services, and non-HTTP protocols.
 */

// Blocked private & internal IPv4/IPv6 ranges
const BLOCKED_IP_PATTERNS = [
  /^127\./,                         // 127.0.0.0/8 (Loopback)
  /^10\./,                          // 10.0.0.0/8 (Private)
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12 (Private)
  /^192\.168\./,                    // 192.168.0.0/16 (Private)
  /^169\.254\./,                    // 169.254.0.0/16 (Link Local & AWS/GCP metadata)
  /^0\./,                           // 0.0.0.0/8
  /^fc00:/i,                        // IPv6 Unique Local
  /^fe80:/i,                        // IPv6 Link-Local
  /^::1$/,                          // IPv6 Loopback
  /^::ffff:127\./i,                 // IPv4-mapped IPv6 loopback
];

const BLOCKED_HOSTNAMES = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  '169.254.169.254',
  'instance-data',
];

export interface SSRFValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  reason?: string;
}

export function validateSafeUrl(rawUrl: string, allowedDomains?: string[]): SSRFValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { isValid: false, reason: 'URL must be a non-empty string' };
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length > 2048) {
    return { isValid: false, reason: 'URL exceeds maximum allowed length (2048 chars)' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, reason: 'Invalid URL syntax' };
  }

  // 1. Protocol validation (HTTP/HTTPS only)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { isValid: false, reason: `Unsupported URL protocol: ${parsed.protocol}. Only http/https are allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Hostname blocklist
  if (BLOCKED_HOSTNAMES.includes(hostname) || hostname.endsWith('.local')) {
    return { isValid: false, reason: `Access to internal host "${hostname}" is prohibited.` };
  }

  // 3. IP address validation
  if (net.isIP(hostname)) {
    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { isValid: false, reason: `Access to private/internal IP address "${hostname}" is blocked.` };
      }
    }
  }

  // 4. Optional domain allowlist (e.g. for YouTube oEmbed)
  if (allowedDomains && allowedDomains.length > 0) {
    const isDomainAllowed = allowedDomains.some((domain) => {
      const d = domain.toLowerCase();
      return hostname === d || hostname.endsWith(`.${d}`);
    });

    if (!isDomainAllowed) {
      return {
        isValid: false,
        reason: `Host "${hostname}" is not in the allowed domain list: ${allowedDomains.join(', ')}`,
      };
    }
  }

  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
  };
}
