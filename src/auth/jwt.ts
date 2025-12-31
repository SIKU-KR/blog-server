/**
 * JWT Generation and Validation
 * CloudFlare Workers crypto API implementation for stateless authentication
 */

import type { JWTPayload } from "../types";

/**
 * Generate JWT token using HMAC-SHA256
 */
export async function generateJWT(
  payload: JWTPayload,
  secret: string
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const data = `${headerB64}.${payloadB64}`;
  const signature = await signData(data, secret);
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Validate JWT token and return payload
 */
export async function validateJWT(
  token: string,
  secret: string
): Promise<JWTPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  const data = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(signatureB64);
  const valid = await verifySignature(data, signature, secret);

  if (!valid) {
    throw new Error("Invalid signature");
  }

  const payload = JSON.parse(base64UrlDecodeString(payloadB64)) as JWTPayload;

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  return payload;
}

/**
 * Sign data using HMAC-SHA256
 */
async function signData(data: string, secret: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  return await crypto.subtle.sign("HMAC", secretKey, encoder.encode(data));
}

/**
 * Verify HMAC-SHA256 signature
 */
async function verifySignature(
  data: string,
  signature: Uint8Array,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return await crypto.subtle.verify(
    "HMAC",
    secretKey,
    signature,
    encoder.encode(data)
  );
}

/**
 * Base64 URL encode (Buffer/ArrayBuffer to string)
 */
function base64UrlEncode(input: string | ArrayBuffer): string {
  let str: string;

  if (typeof input === "string") {
    str = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    str = btoa(binary);
  }

  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64 URL decode (string to ArrayBuffer)
 */
function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) {
    str += "=".repeat(4 - pad);
  }
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

/**
 * Base64 URL decode to string
 */
function base64UrlDecodeString(str: string): string {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) {
    str += "=".repeat(4 - pad);
  }
  return atob(str);
}

/**
 * Create JWT payload with standard claims
 */
export function createPayload(
  userId: number,
  expiresInSeconds = 7200
): JWTPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    userId,
    iat: now,
    exp: now + expiresInSeconds,
  };
}

/**
 * Hash password using SHA-256 with salt
 */
export async function hashPassword(
  password: string,
  salt: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
