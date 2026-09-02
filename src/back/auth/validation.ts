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

// ==================== LOBBIES ====================

/** Le nom est optionnel (un nom par défaut est généré côté serveur si vide) ;
 * on valide juste qu'il ne dépasse pas une longueur raisonnable s'il est fourni. */
export function validateLobbyName(name: string): string | null {
  if (name.length > 40) {
    return "Le nom du lobby ne peut pas dépasser 40 caractères.";
  }
  return null;
}

/** Le mot de passe de lobby est optionnel (lobby public si vide) mais doit
 * rester raisonnable s'il est fourni — pas les mêmes exigences qu'un mot de
 * passe de compte utilisateur. */
export function validateLobbyPassword(password: string): string | null {
  if (password.length < 4) {
    return "Le mot de passe du lobby doit faire au moins 4 caractères.";
  }
  if (password.length > 64) {
    return "Le mot de passe du lobby est trop long.";
  }
  return null;
}