/**
 * JWT utilities tests
 */

import { describe, it, expect } from "vitest";
import {
  generateJWT,
  validateJWT,
  createPayload,
  hashPassword,
} from "../../src/auth/jwt";

describe("JWT Functions", () => {
  const secret = "test-secret-key-for-testing";

  describe("createPayload", () => {
    it("should create payload with userId and timestamps", () => {
      const payload = createPayload(1, 3600);

      expect(payload.userId).toBe(1);
      expect(payload.iat).toBeDefined();
      expect(payload.exp).toBeDefined();
      expect(payload.exp - payload.iat).toBe(3600);
    });

    it("should use default expiry of 7200 seconds", () => {
      const payload = createPayload(1);

      expect(payload.exp - payload.iat).toBe(7200);
    });
  });

  describe("generateJWT and validateJWT", () => {
    it("should generate and validate a valid token", async () => {
      const payload = createPayload(1, 3600);
      const token = await generateJWT(payload, secret);

      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(3);

      const decoded = await validateJWT(token, secret);
      expect(decoded.userId).toBe(1);
    });

    it("should throw for invalid token format", async () => {
      await expect(validateJWT("invalid-token", secret)).rejects.toThrow(
        "Invalid token format"
      );
    });

    it("should throw for invalid signature", async () => {
      const payload = createPayload(1, 3600);
      const token = await generateJWT(payload, secret);

      await expect(
        validateJWT(token, "wrong-secret")
      ).rejects.toThrow("Invalid signature");
    });

    it("should throw for expired token", async () => {
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        userId: 1,
        iat: now - 7200,
        exp: now - 3600, // Expired 1 hour ago
      };
      const token = await generateJWT(payload, secret);

      await expect(validateJWT(token, secret)).rejects.toThrow("Token expired");
    });
  });

  describe("hashPassword", () => {
    it("should hash password with salt", async () => {
      const hash = await hashPassword("password123", "salt123");

      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it("should produce different hashes for different salts", async () => {
      const hash1 = await hashPassword("password123", "salt1");
      const hash2 = await hashPassword("password123", "salt2");

      expect(hash1).not.toBe(hash2);
    });

    it("should produce consistent hash for same inputs", async () => {
      const hash1 = await hashPassword("password123", "salt123");
      const hash2 = await hashPassword("password123", "salt123");

      expect(hash1).toBe(hash2);
    });
  });
});
