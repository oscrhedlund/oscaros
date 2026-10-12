const sessionCookieName = "personal_os_session";
const sessionLifetimeSeconds = 30 * 24 * 60 * 60;

export type AppSession = {
  email: string;
  name: string;
  issuedAt: number;
  expiresAt: number;
};

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function safeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function readCookie(headers: Headers, name: string) {
  const cookieHeader = headers.get("Cookie") || "";
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function getSessionCookie(headers: Headers) {
  return readCookie(headers, sessionCookieName);
}

export async function createSessionToken(email: string, name: string, secret: string, now = Date.now()) {
  const payload: AppSession = {
    email: email.toLowerCase(),
    name: name.slice(0, 160),
    issuedAt: Math.floor(now / 1000),
    expiresAt: Math.floor(now / 1000) + sessionLifetimeSeconds,
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifySessionToken(
  token: string | null,
  secret: string,
  allowedEmail: string,
  now = Date.now(),
): Promise<AppSession | null> {
  if (!token || token.length > 2048 || !secret || !allowedEmail) return null;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  try {
    const key = await hmacKey(secret);
    const signatureBytes = base64UrlDecode(signature);
    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(body));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as Partial<AppSession>;
    const currentSeconds = Math.floor(now / 1000);
    if (
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      payload.issuedAt > currentSeconds + 60 ||
      payload.expiresAt <= currentSeconds ||
      payload.expiresAt - payload.issuedAt > sessionLifetimeSeconds ||
      !safeEqual(payload.email.toLowerCase(), allowedEmail.toLowerCase())
    ) return null;
    return payload as AppSession;
  } catch {
    return null;
  }
}

export const appSessionCookie = {
  name: sessionCookieName,
  maxAge: sessionLifetimeSeconds,
};
