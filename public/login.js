
const API_BASE = `${location.protocol}//${location.hostname}:3000`;


// ── Navigation entre les onglets ──────────────────────────────────────────────
function showTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("form-login").hidden    = !isLogin;
  document.getElementById("form-register").hidden =  isLogin;
  document.getElementById("tab-login").classList.toggle("active",  isLogin);
  document.getElementById("tab-register").classList.toggle("active", !isLogin);
  clearErrors();
}


// ── Gestion des erreurs ───────────
//fonctions d'affichage d'erreur dans la page
function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.hidden = false;
}
function clearErrors() {
    document.getElementById("login-error").hidden = true;
    document.getElementById("register-error").hidden = true;
}


// ── État des boutons ────
//gestion de l'état du bouton pendant la requête
function setLoading(id, loading) {
    const btn = document.getElementById(id);
    btn.disabled = loading;
    btn.textContent = loading ? "Chargement…" : "Login";
}

// ── Login────
async function login(){

    clearErrors();

    let username_id = document.getElementById("username");
    let password_id = document.getElementById("password");

    const username = username_id.value.trim();
    const password = password_id.value;

    if (!username || !password) {
        alert("Veuillez remplir tous les champs.");
        return;
    }

    const user_info = { username, password };

    //désactive le bouton avant la requête
    setLoading("login_button", true);

    try {
        // MODIFIÉ : API_BASE à la place de "http://localhost:3000"
        const rep = await fetch(`${API_BASE}/login`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(user_info)
        });

        const data = await rep.json();

        if (rep.ok) {
            window.location.href = "index.html";
        } else {
            showError("login-error", data.error ?? "Erreur de connexion.");
        }
    } catch{
        showError("login-error", "Impossible de contacter le serveur.");
    } finally {
        //réactive le bouton dans tous les cas (succès ou erreur)
        setLoading("login_button", false);
    }
}

// ── Inscription ───────────────────────────────────────────────────────────────
async function register() {
  clearErrors();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm  = document.getElementById("reg-confirm").value;

  if (!username || !password || !confirm) {
    showError("register-error", "Veuillez remplir tous les champs.");
    return;
  }
  if (password !== confirm) {
    showError("register-error", "Les mots de passe ne correspondent pas.");
    return;
  }
  if (password.length < 8) {
    showError("register-error", "Le mot de passe doit contenir au moins 8 caractères.");
    return;
  }

  setLoading("btn-register", true);
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = "/index.html";
    } else {
      showError("register-error", data.error ?? "Erreur lors de la création du compte.");
    }
  } catch {
    showError("register-error", "Impossible de contacter le serveur.");
  } finally {
    setLoading("btn-register", false);
  }
}