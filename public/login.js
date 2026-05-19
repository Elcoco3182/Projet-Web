

async function VerifyUser(){
    let username_id = document.getElementById("username");
    let password_id = document.getElementById("password");

    const user_info = {
        username : username_id.value,
        password : password_id.value
    };

    try {
        const rep = await fetch("http://localhost:3000/login", {
            method: "POST",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
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
