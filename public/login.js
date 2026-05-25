
// ── Login────
const API_BASE = `${location.protocol}//${location.hostname}:3000`;

//fonctions d'affichage d'erreur dans la page
function showError(id, msg) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.hidden = false;
}
function clearErrors() {
    document.getElementById("login-error").hidden = true;
}

async function VerifyUser(){

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
            showError("login-error", data.error);
        }
    } catch (error) {
        console.error("Erreur lors de la requête:", error);
        showError("login-error", "Impossible de contacter le serveur.");
    }
}