/**
 * Downloads a web page for the recipe import.
 *
 * Fetching an address that a user typed is a classic security hole called
 * SSRF (server-side request forgery): the request is made from our server, so
 * an address like http://localhost/ or http://10.0.0.5/ would reach things
 * that are not meant to be public. This file is the guard against that:
 *
 * - only http and https, on their normal ports, without a username/password
 * - private, local and otherwise special IP addresses are refused. The check
 *   sits inside the connection itself (`publicLookup` below), so the address
 *   that was checked is the address that is connected to. Looking the name up
 *   first and fetching afterwards would be two lookups, and a hostile DNS
 *   server could give a harmless answer to the first and 127.0.0.1 to the second.
 * - redirects are followed by hand, so every hop gets the same checks
 * - a time limit and a size limit, so a slow or huge page can't hang us
 */
import { lookup } from 'node:dns';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { Agent, fetch, type Response } from 'undici';

export interface FetchedPage {
  html: string;
  /** Where the page really was, after redirects. */
  url: string;
}

export type FetchPage = (url: string) => Promise<FetchedPage>;

/** Something went wrong that the user can be told about. The message is in Swedish. */
export class PageFetchError extends Error {}

/** For everything from the first lookup to the last byte, redirects included. */
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 5;
/** Recipe pages are well under 1 MB. Anything past this is cut off, not downloaded. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Says honestly that this is a program, not a person with a browser. */
const USER_AGENT = 'Mozilla/5.0 (compatible; RecipeImporter/1.0; personal recipe collection)';

/**
 * One message for "refused" and "unreachable" alike, so the import can't be
 * used to find out what exists on a private network.
 */
const UNREACHABLE = 'Kunde inte hämta sidan. Kontrollera länken och försök igen.';

// Addresses that are not ordinary public internet hosts.
const blocked = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // this machine
  ['169.254.0.0', 16], // link-local, where cloud metadata services live
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 127], // unspecified (::) and this machine (::1)
  ['64:ff9b::', 96], // IPv4 addresses translated into IPv6
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // private
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6');
}

/** True for an IP address on the public internet. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;
  // An IPv4 address written as IPv6 (::ffff:127.0.0.1) is checked by BlockList
  // against the IPv4 rules as well.
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/**
 * Looks a host name up the way Node always does, but fails if any of the
 * answers is not a public address. Node calls this while connecting, and
 * connects to exactly what it returns.
 */
const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, options, (err, address, family) => {
    // One address, or a list when Node asks for all of them (to try IPv6 and IPv4).
    const addresses = typeof address === 'string' ? [address] : address.map((a) => a.address);
    if (!err && !addresses.every(isPublicAddress)) {
      callback(new Error(`Refusing to connect to ${hostname}: not a public address`), address);
    } else {
      callback(err, address, family);
    }
  });
};

/** undici is the HTTP client behind Node's own fetch; an Agent holds its connection settings. */
const agent = new Agent({ connect: { lookup: publicLookup } });

/** Throws unless `url` could be an ordinary public web page. */
export function assertPublicUrl(url: URL): void {
  const isWeb = url.protocol === 'http:' || url.protocol === 'https:';
  if (!isWeb || url.port !== '' || url.username !== '' || url.password !== '') {
    throw new PageFetchError(UNREACHABLE);
  }
  // A host given as an IP address is never looked up, so publicLookup would
  // not see it. (In a URL an IPv6 address is in brackets: http://[::1]/)
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0 && !isPublicAddress(host)) throw new PageFetchError(UNREACHABLE);
}

/** Reads the body as text, stopping at MAX_BYTES. */
async function readText(res: Response): Promise<string> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (res.body) {
    const reader = res.body.getReader();
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
    await reader.cancel().catch(() => {});
  }
  // The character encoding is in the header; without one it is UTF-8, like
  // nearly all pages today.
  const charset = /charset=["']?([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
  const bytes = Buffer.concat(chunks);
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes);
  } catch {
    return new TextDecoder().decode(bytes); // an encoding name we don't know
  }
}

export const fetchPage: FetchPage = async (startUrl) => {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let url = new URL(startUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    assertPublicUrl(url);

    let res: Response;
    try {
      res = await fetch(url, {
        dispatcher: agent,
        signal,
        // Don't follow redirects automatically: each hop is checked above first.
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'sv,en;q=0.8',
        },
      });
    } catch {
      throw new PageFetchError(UNREACHABLE);
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      await res.body?.cancel().catch(() => {});
      if (!location || !URL.canParse(location, url)) throw new PageFetchError(UNREACHABLE);
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      // Often 403: the site turns away programs. Worth saying, since it is
      // nothing a different link to the same site will fix.
      throw new PageFetchError(`Sidan gick inte att hämta (den svarade ${res.status}).`);
    }
    if (!/html/i.test(res.headers.get('content-type') ?? '')) {
      await res.body?.cancel().catch(() => {});
      throw new PageFetchError('Länken går inte till en webbsida.');
    }
    try {
      return { html: await readText(res), url: url.href };
    } catch {
      throw new PageFetchError(UNREACHABLE);
    }
  }
  throw new PageFetchError(UNREACHABLE);
};
