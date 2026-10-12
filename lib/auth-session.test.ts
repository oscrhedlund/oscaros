import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node loads this test directly without a TypeScript bundler.
import { appSessionCookie, createSessionToken, getSessionCookie, safeEqual, verifySessionToken } from "./auth-session.ts";

const secret = "test-only-session-secret-long-enough";

test("Google-owner session tokens are signed, persistent, and restricted to one account", async () => {
  const now = Date.UTC(2026, 9, 12);
  const token = await createSessionToken("Owner@Example.com", "Owner", secret, now);
  const session = await verifySessionToken(token, secret, "owner@example.com", now + 60_000);
  assert.ok(session);
  assert.equal(session?.email, "owner@example.com");
  assert.equal(session?.name, "Owner");
  assert.equal(session.expiresAt - session.issuedAt, appSessionCookie.maxAge);
  assert.equal(await verifySessionToken(token, secret, "other@example.com", now), null);
  assert.equal(await verifySessionToken(`${token}x`, secret, "owner@example.com", now), null);
  assert.equal(await verifySessionToken(token, "a-different-secret-that-is-long-enough", "owner@example.com", now), null);
  assert.equal(await verifySessionToken(token, secret, "owner@example.com", now + (appSessionCookie.maxAge + 1) * 1000), null);
});

test("session cookies are read without accepting malformed values", () => {
  const headers = new Headers({ Cookie: "other=value; personal_os_session=abc%2Edef" });
  assert.equal(getSessionCookie(headers), "abc.def");
  assert.equal(getSessionCookie(new Headers({ Cookie: "personal_os_session=%E0%A4%A" })), null);
  assert.equal(getSessionCookie(new Headers()), null);
});

test("credential comparison accepts only exact values", () => {
  assert.equal(safeEqual("Owner@Example.com", "Owner@Example.com"), true);
  assert.equal(safeEqual("Owner@Example.com", "owner@example.com"), false);
  assert.equal(safeEqual("correct horse battery staple", "correct horse battery staplex"), false);
});
