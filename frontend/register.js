const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    message.textContent = "Creating account...";

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            let errorMessage = data.detail || "Registration failed";

            if (Array.isArray(errorMessage)) {
                errorMessage = errorMessage
                    .map(item =>
                        typeof item === "object"
                            ? `${item.loc ? item.loc.join(" → ") + ": " : ""}${item.msg || JSON.stringify(item)}`
                            : String(item)
                    )
                    .join(", ");
            } else if (typeof errorMessage === "object") {
                errorMessage = JSON.stringify(errorMessage);
            }

            throw new Error(String(errorMessage));
        }

        message.textContent =
            data.message || "Registration successful! Please log in.";

        registerForm.reset();

    } catch (error) {
        message.textContent =
            error.message || "Cannot connect to server.";
    }
});