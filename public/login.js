
// ── Login────
const API_BASE = `${location.protocol}//${location.hostname}:3000`;

async function VerifyUser(){
    let username_id = document.getElementById("username");
    let password_id = document.getElementById("password");

    // MODIFIÉ : .trim() pour supprimer les espaces accidentels
    const username = username_id.value.trim();
    const password = password_id.value;

    // AJOUTÉ : validation avant d'envoyer la requête
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
            alert("Connexion réussie !");
            window.location.href = "index.html";
        } else {
            alert("Erreur : " + data.error);
        }
    } catch (error) {
        console.error("Erreur lors de la requête:", error);
        alert("Impossible de contacter le serveur backend.");
    }
}