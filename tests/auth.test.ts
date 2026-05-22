// deno test --allow-env tests/auth.test.ts

import { assertEquals } from "@std/assert";

// ── Copie locale des fonctions pures de server.ts ──────────────────────────
// Idéalement, tu les extrais dans src/utils/validators.ts et tu importes d'ici.

function validateUsername(username: string): string | null {
  if (!username || username.length < 3) {
    return "Le nom d'utilisateur doit faire au moins 3 caractères.";
  }
  if (username.length > 30) {
    return "Le nom d'utilisateur ne peut pas dépasser 30 caractères.";
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Le nom d'utilisateur ne peut contenir que des lettres, chiffres et underscores.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Le mot de passe doit faire au moins 8 caractères.";
  }
  if (password.length > 128) return "Le mot de passe est trop long.";
  return null;
}

// ── Tests username ─────────────────────────────────────────────────────────
Deno.test("username valide", () =>
  assertEquals(validateUsername("coco"), null));
Deno.test("username trop court", () =>
  assertEquals(
    validateUsername("ab"),
    "Le nom d'utilisateur doit faire au moins 3 caractères.",
  ));
Deno.test("username trop long", () =>
  assertEquals(
    validateUsername("a".repeat(31)),
    "Le nom d'utilisateur ne peut pas dépasser 30 caractères.",
  ));
Deno.test("username avec caractères spéciaux", () =>
  assertEquals(typeof validateUsername("hack@me!"), "string"));
Deno.test("username avec underscore ok", () =>
  assertEquals(validateUsername("mon_pseudo"), null));

// ── Tests password ─────────────────────────────────────────────────────────
Deno.test("password valide", () =>
  assertEquals(validatePassword("motdepasse123"), null));
Deno.test("password trop court", () =>
  assertEquals(
    validatePassword("court"),
    "Le mot de passe doit faire au moins 8 caractères.",
  ));
Deno.test("password trop long", () =>
  assertEquals(
    validatePassword("a".repeat(129)),
    "Le mot de passe est trop long.",
  ));
