
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