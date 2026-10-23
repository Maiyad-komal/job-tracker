const token = localStorage.getItem("access_token");

// HTML elements
const studentName = document.getElementById("studentName");
const jobsList = document.getElementById("jobsList");
const jobsMessage = document.getElementById("jobsMessage");
const applicationsTable = document.getElementById("applicationsTable");
const applicationsMessage = document.getElementById("applicationsMessage");

// Show message
function showMessage(id, message, success = false) {
    const element = document.getElementById(id);

    if (!element) {
        console.warn("HTML element not found:", id);
        return;
    }

    element.textContent = message;
    element.style.display = "block";
    element.style.visibility = "visible";
    element.style.opacity = "1";
    element.style.minHeight = "30px";
    element.style.fontWeight = "bold";
    element.style.color = success ? "green" : "red";
}

// API request
async function apiRequest(path, options = {}) {
    if (!token) {
        window.location.href = "login.html";
        throw new Error("Please login first.");
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("user_role");
        localStorage.removeItem("user_name");
        window.location.href = "login.html";
        throw new Error("Session expired. Please login again.");
    }

    if (!response.ok) {
        throw new Error(
            data.detail || data.message || "Request failed."
        );
    }

    return data;
}

// Load student name
function loadStudentName() {
    if (studentName) {
        studentName.textContent =
            localStorage.getItem("user_name") || "Student";
    }
}

// Load profile
async function loadProfile() {
    try {
        const data = await apiRequest("/student/profile");

        const phone = document.getElementById("phone");
        const course = document.getElementById("course");
        const graduationYear =
            document.getElementById("graduationYear");

        if (phone) phone.value = data.phone || "";
        if (course) course.value = data.course || "";

        if (graduationYear) {
            graduationYear.value = data.graduation_year || "";
        }
    } catch (error) {
        console.error("Profile loading error:", error);
    }
}

// Save profile
const profileForm = document.getElementById("profileForm");

if (profileForm) {
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const phone =
            document.getElementById("phone")?.value.trim() || "";
        const course =
            document.getElementById("course")?.value.trim() || "";
        const year =
            document.getElementById("graduationYear")?.value.trim() || "";

        try {
            await apiRequest("/student/profile", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    phone: phone,
                    course: course,
                    graduation_year: year ? Number(year) : null
                })
            });

            const message = document.getElementById("profileMessage");

            if (message) {
                message.textContent = "Profile saved successfully!";
                message.style.color = "green";
            } else {
                alert("Profile saved successfully!");
            }
        } catch (error) {
            alert(error.message || "Profile save failed.");
        }
    });
}

// Upload resume
const resumeForm = document.getElementById("resumeForm");

if (resumeForm) {
    resumeForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const fileInput = document.getElementById("resume");
        const file = fileInput?.files?.[0];

        if (!file) {
            showMessage("resumeMessage", "Please select your PDF resume.");
            return;
        }

        if (
            file.type !== "application/pdf" ||
            !file.name.toLowerCase().endsWith(".pdf")
        ) {
            showMessage("resumeMessage", "Only PDF files are allowed.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showMessage(
                "resumeMessage",
                "Resume must be 5 MB or smaller."
            );
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        showMessage("resumeMessage", "Uploading resume...", true);

        try {
            const data = await apiRequest("/student/resume", {
                method: "POST",
                body: formData
            });

            const successText =
                data.message || "Resume uploaded successfully!";

            showMessage("resumeMessage", successText, true);
            alert(successText);

            console.log("Resume upload successful:", data);
        } catch (error) {
            showMessage(
                "resumeMessage",
                error.message || "Resume upload failed."
            );
        }
    });
}

// Load available jobs
async function loadJobs() {
    if (!jobsList) return;

    jobsList.textContent = "Loading jobs...";

    try {
        const data = await apiRequest("/jobs");
        const jobs = Array.isArray(data) ? data : (data.jobs || []);

        jobsList.innerHTML = "";

        if (jobs.length === 0) {
            jobsList.textContent = "No jobs available right now.";
            return;
        }

        jobs.forEach(function (job) {
            const card = document.createElement("div");
            card.className = "job-card";

            const title = document.createElement("h3");
            title.textContent =
                job.title || job.role || job.position || "Job";

            const company = document.createElement("p");
            company.textContent =
                "Company: " +
                (job.company_name || job.company || "Not specified");

            const description = document.createElement("p");
            description.textContent =
                job.description || job.location || "";

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Apply Now";

            button.addEventListener("click", function () {
                applyForJob(job.id);
            });

            card.append(title, company, description, button);
            jobsList.appendChild(card);
        });
    } catch (error) {
        jobsList.textContent = "";
        showMessage(
            "jobsMessage",
            error.message || "Could not load jobs."
        );
    }
}

// Apply for job
async function applyForJob(jobId) {
    try {
        const data = await apiRequest(
            `/jobs/${encodeURIComponent(jobId)}/apply`,
            { method: "POST" }
        );

        alert(data.message || "Application submitted successfully!");

        await loadApplications();
        await loadStudentStats();
    } catch (error) {
        alert(error.message || "Could not apply for this job.");
    }
}

// Load applications
async function loadApplications() {
    if (!applicationsTable) return;

    applicationsTable.innerHTML = "";
    applicationsTable.textContent = "Loading applications...";

    try {
        const data = await apiRequest("/student/applications");

        const applications = Array.isArray(data)
            ? data
            : (data.applications || []);

        applicationsTable.innerHTML = "";

        if (applications.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 4;
            cell.textContent = "You have not applied for any jobs yet.";

            row.appendChild(cell);
            applicationsTable.appendChild(row);
            return;
        }

        applications.forEach(function (application) {
            const row = document.createElement("tr");

            const company = document.createElement("td");
            company.textContent =
                application.company_name ||
                application.company ||
                "Not specified";

            const position = document.createElement("td");
            position.textContent =
                application.job_title ||
                application.title ||
                application.position ||
                application.role ||
                "Not specified";

            const status = document.createElement("td");
            status.textContent =
                application.status || "Applied";

            const appliedOn = document.createElement("td");
            const date =
                application.applied_at ||
                application.applied_on ||
                application.created_at ||
                application.application_date;

            appliedOn.textContent = date
                ? String(date).slice(0, 10)
                : "—";

            row.append(company, position, status, appliedOn);
            applicationsTable.appendChild(row);
        });
    } catch (error) {
        applicationsTable.innerHTML = "";

        showMessage(
            "applicationsMessage",
            error.message || "Could not load applications."
        );
    }
}

// Load dashboard statistics
async function loadStudentStats() {
    try {
        const [jobsData, applicationsData] = await Promise.all([
            apiRequest("/jobs"),
            apiRequest("/student/applications")
        ]);

        const jobs = Array.isArray(jobsData)
            ? jobsData
            : (jobsData.jobs || []);

        const applications = Array.isArray(applicationsData)
            ? applicationsData
            : (applicationsData.applications || []);

        const availableJobs = document.getElementById("availableJobs");
        const totalApplications =
            document.getElementById("totalApplications");
        const shortlistedApplications =
            document.getElementById("shortlistedApplications");
        const selectedApplications =
            document.getElementById("selectedApplications");

        if (availableJobs) {
            availableJobs.textContent = jobs.length;
        }

        if (totalApplications) {
            totalApplications.textContent = applications.length;
        }

        const shortlistedCount = applications.filter(app =>
            String(app.status || "").trim().toLowerCase() === "shortlisted"
        ).length;

        const selectedCount = applications.filter(app =>
            String(app.status || "").trim().toLowerCase() === "selected"
        ).length;

        if (shortlistedApplications) {
            shortlistedApplications.textContent = shortlistedCount;
        }

        if (selectedApplications) {
            selectedApplications.textContent = selectedCount;
        }

        console.log("Student stats:", {
            availableJobs: jobs.length,
            totalApplications: applications.length,
            shortlisted: shortlistedCount,
            selected: selectedCount
        });
    } catch (error) {
        console.error("Student dashboard stats error:", error);
    }
}

// Logout
function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    window.location.href = "login.html";
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", logout);
}

// Start dashboard
loadStudentName();
loadProfile();
loadJobs();
loadApplications();
loadStudentStats();