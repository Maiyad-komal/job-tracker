const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        message.textContent = "Logging in...";

        try {
            const formData = new URLSearchParams();
            formData.append("username", username);
            formData.append("password", password);

            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || "Login failed");
            }

            const role = data.user?.role;

            if (!data.access_token || !role) {
                console.error("Unexpected login response:", data);
                throw new Error("User role missing in login response.");
            }

            if (role !== "admin" && role !== "student") {
                throw new Error("Invalid role: " + role);
            }

            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("user_role", role);
            localStorage.setItem(
                "user_name",
                data.user.name || username
            );

            alert("Logged-in role: " + role);

            if (role === "admin") {
                window.location.href = "./admin-dashboard.html";
            } else {
                window.location.href = "./student-dashboard.html";
            }

        } catch (error) {
            console.error("Login error:", error);
            message.textContent = error.message ||
                "Cannot connect to server.";
        }
    });
} else {
    console.error("Login form not found on this page.");
}