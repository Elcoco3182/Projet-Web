export function validateUsername(username: string): string | null {
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

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Le mot de passe doit faire au moins 8 caractères.";
  }
  if (password.length > 128) return "Le mot de passe est trop long.";
  return null;
}
