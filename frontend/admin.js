document.addEventListener("DOMContentLoaded", () => {
    const API = "http://127.0.0.1:8000";

    function getToken() {
        return localStorage.getItem("access_token");
    }

    function logout() {
        localStorage.removeItem("access_token");
        window.location.href = "login.html";
    }

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    if (!getToken()) {
        alert("Please login first.");
        window.location.href = "login.html";
        return;
    }

    async function apiRequest(path, options = {}) {
        const token = getToken();

        const headers = {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        };

        const response = await fetch(`${API}${path}`, {
            ...options,
            headers
        });

        let data = null;

        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                response.status === 401
                    ? "Session expired. Please log in again."
                    : "Access denied. Please log in with an admin account."
            );
        }

        if (!response.ok) {
            const detail = data?.detail;
            throw new Error(
                typeof detail === "string"
                    ? detail
                    : detail
                        ? JSON.stringify(detail)
                        : `Request failed (${response.status})`
            );
        }

        return data;
    }

    function showMessage(element, message, isError = false) {
        if (!element) return;

        element.textContent = message;
        element.style.color = isError ? "red" : "green";
    }

    // ==========================================
    // 1. LOAD STUDENT APPLICATIONS
    // ==========================================

    async function loadApplications() {
        const tableBody = document.getElementById("applicationsTable");

        if (!tableBody) return;

        tableBody.innerHTML =
            "<tr><td colspan='7'>Loading applications...</td></tr>";

        try {
            const applications = await apiRequest("/admin/applications");

            tableBody.innerHTML = "";

            if (!Array.isArray(applications) || applications.length === 0) {
                tableBody.innerHTML =
                    "<tr><td colspan='7'>No applications found.</td></tr>";
                return;
            }

            applications.forEach((app) => {
                const row = document.createElement("tr");

                function addCell(value) {
                    const cell = document.createElement("td");
                    cell.textContent = value ?? "-";
                    row.appendChild(cell);
                    return cell;
                }

                addCell(app.student_name);
                addCell(app.student_email);
                addCell(app.company_name);
                addCell(app.job_title);
                addCell(app.status || "Applied");

                // Status dropdown and update button
                const actionCell = document.createElement("td");
                const statusSelect = document.createElement("select");

                const statuses = [
                    "Applied",
                    "Under Review",
                    "Shortlisted",
                    "Selected",
                    "Rejected"
                ];

                statuses.forEach((status) => {
                    const option = document.createElement("option");
                    option.value = status;
                    option.textContent = status;
                    statusSelect.appendChild(option);
                });

                const currentStatus = String(
                    app.status || "Applied"
                ).toLowerCase();

                const matchingStatus = statuses.find(
                    status => status.toLowerCase() === currentStatus
                );

                statusSelect.value = matchingStatus || "Applied";

                const updateButton = document.createElement("button");
                updateButton.type = "button";
                updateButton.textContent = "Update Status";

                const message = document.createElement("span");
                message.style.marginLeft = "8px";

                updateButton.addEventListener("click", async () => {
                    if (app.id == null) {
                        showMessage(
                            message,
                            "Application ID is missing.",
                            true
                        );
                        return;
                    }

                    updateButton.disabled = true;
                    showMessage(message, "Saving...");

                    try {
                        await apiRequest(
                            `/admin/applications/${app.id}/status`,
                            {
                                method: "PUT",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({
                                    status: statusSelect.value
                                })
                            }
                        );

                        showMessage(message, "Updated successfully!");

                        // Reload the table with saved status
                        await loadApplications();

                    } catch (error) {
                        console.error("Status update error:", error);
                        showMessage(
                            message,
                            error.message || "Could not update status.",
                            true
                        );
                    } finally {
                        updateButton.disabled = false;
                    }
                });

                actionCell.appendChild(statusSelect);
                actionCell.appendChild(document.createElement("br"));
                actionCell.appendChild(updateButton);
                actionCell.appendChild(message);
                row.appendChild(actionCell);

                // Resume link
                const resumeCell = document.createElement("td");

                if (app.resume_path) {
                    const resumeURL = app.resume_path.startsWith("http")
                        ? app.resume_path
                        : `${API}${app.resume_path.startsWith("/")
                            ? app.resume_path
                            : "/" + app.resume_path}`;

                    const link = document.createElement("a");
                    link.href = resumeURL;
                    link.textContent = "View Resume";
                    link.target = "_blank";
                    link.rel = "noopener noreferrer";

                    resumeCell.appendChild(link);
                } else {
                    resumeCell.textContent = "No resume uploaded";
                }

                row.appendChild(resumeCell);
                tableBody.appendChild(row);
            });

        } catch (error) {
            console.error("Applications error:", error);

            tableBody.innerHTML = "";

            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 7;
            cell.textContent =
                error.message || "Could not load applications.";

            row.appendChild(cell);
            tableBody.appendChild(row);
        }
    }

    // ==========================================
    // 2. LOAD COMPANIES
    // ==========================================

    async function loadCompanies() {
        const companyTable = document.getElementById("companiesTable");
        const companyDropdown = document.getElementById("jobCompany");

        try {
            const companies = await apiRequest("/companies");

            if (!Array.isArray(companies)) {
                throw new Error("Invalid companies response.");
            }

            if (companyDropdown) {
                const previousValue = companyDropdown.value;

                companyDropdown.innerHTML =
                    '<option value="">Select a company</option>';

                companies.forEach((company) => {
                    const option = document.createElement("option");
                    option.value = company.id;
                    option.textContent = company.name;
                    companyDropdown.appendChild(option);
                });

                if (
                    [...companyDropdown.options].some(
                        option => option.value === previousValue
                    )
                ) {
                    companyDropdown.value = previousValue;
                }
            }

            if (companyTable) {
                companyTable.innerHTML = "";

                if (companies.length === 0) {
                    companyTable.innerHTML =
                        "<tr><td colspan='3'>No companies found.</td></tr>";
                }

                companies.forEach((company) => {
                    const row = document.createElement("tr");

                    const nameCell = document.createElement("td");
                    nameCell.textContent = company.name || "-";
                    row.appendChild(nameCell);

                    const websiteCell = document.createElement("td");

                    if (company.website) {
                        const websiteLink = document.createElement("a");
                        websiteLink.href = company.website;
                        websiteLink.textContent = company.website;
                        websiteLink.target = "_blank";
                        websiteLink.rel = "noopener noreferrer";
                        websiteCell.appendChild(websiteLink);
                    } else {
                        websiteCell.textContent = "-";
                    }

                    row.appendChild(websiteCell);

                    const actionCell = document.createElement("td");
                    actionCell.textContent = "Added";
                    row.appendChild(actionCell);

                    companyTable.appendChild(row);
                });
            }

        } catch (error) {
            console.error("Companies error:", error);
        }
    }

    // ==========================================
    // 3. ADD COMPANY
    // ==========================================

    const companyForm = document.getElementById("companyForm");

    if (companyForm) {
        companyForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const message = document.getElementById("companyMessage");
            const name =
                document.getElementById("companyName")?.value.trim() || "";

            const description =
                document.getElementById("companyDescription")?.value.trim() || "";

            const website =
                document.getElementById("companyWebsite")?.value.trim() || "";

            if (!name) {
                showMessage(message, "Please enter company name.", true);
                return;
            }

            showMessage(message, "Adding company...");

            try {
                await apiRequest("/admin/companies", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        name,
                        description: description || null,
                        website: website || null
                    })
                });

                showMessage(message, "Company added successfully!");
                companyForm.reset();

                await loadCompanies();

            } catch (error) {
                console.error("Add company error:", error);
                showMessage(
                    message,
                    "Could not add company: " + error.message,
                    true
                );
            }
        });
    }

    // ==========================================
    // 4. ADD JOB
    // ==========================================

    const jobForm = document.getElementById("jobForm");

    if (jobForm) {
        jobForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const message = document.getElementById("jobMessage");
            const title =
                document.getElementById("jobTitle")?.value.trim() || "";

            const companyId =
                document.getElementById("jobCompany")?.value || "";

            const description =
                document.getElementById("jobDescription")?.value.trim() || "";

            const skills =
                document.getElementById("jobSkills")?.value.trim() || "";

            const eligibility =
                document.getElementById("jobEligibility")?.value.trim() || "";

            const deadline =
                document.getElementById("jobDeadline")?.value || "";

            const location =
                document.getElementById("jobLocation")?.value.trim() || "Not specified";

            const jobType =
                document.getElementById("jobType")?.value || "Full-time";

            const salary =
                document.getElementById("jobSalary")?.value.trim() || "Negotiable";

            if (!title || !companyId || !description || !deadline) {
                showMessage(
                    message,
                    "Please enter job title, company, description and deadline.",
                    true
                );
                return;
            }

            showMessage(message, "Posting job...");

            try {
                const jobData = {
                    title,
                    description,
                    location,
                    job_type: jobType,
                    salary,
                    deadline: deadline.length === 10
                        ? `${deadline}T23:59:00`
                        : deadline,
                    company_id: Number(companyId)
                };

                // Include these fields only if they are filled in
                if (skills) jobData.required_skills = skills;
                if (eligibility) jobData.eligibility = eligibility;

                await apiRequest("/admin/jobs", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(jobData)
                });

                showMessage(message, "Job posted successfully!");
                jobForm.reset();

                await loadCompanies();
                await loadJobs();

            } catch (error) {
                console.error("Add job error:", error);
                showMessage(
                    message,
                    "Could not post job: " + error.message,
                    true
                );
            }
        });
    }

    // ==========================================
    // 5. LOAD JOBS
    // ==========================================

    async function loadJobs() {
        const jobsTable = document.getElementById("jobsTable");

        if (!jobsTable) return;

        jobsTable.innerHTML =
            "<tr><td colspan='5'>Loading jobs...</td></tr>";

        try {
            const jobs = await apiRequest("/jobs");
            jobsTable.innerHTML = "";

            if (!Array.isArray(jobs) || jobs.length === 0) {
                jobsTable.innerHTML =
                    "<tr><td colspan='5'>No jobs found.</td></tr>";
                return;
            }

            jobs.forEach((job) => {
                const row = document.createElement("tr");

                [
                    job.title,
                    job.company_name,
                    job.location,
                    job.job_type,
                    job.deadline
                ].forEach((value) => {
                    const cell = document.createElement("td");
                    cell.textContent = value ?? "-";
                    row.appendChild(cell);
                });

                jobsTable.appendChild(row);
            });

        } catch (error) {
            console.error("Jobs error:", error);
            jobsTable.innerHTML =
                "<tr><td colspan='5'>Could not load jobs: " +
                (error.message || "Unknown error") +
                "</td></tr>";
        }
    }

// ==========================================
    // DASHBOARD STATISTICS
    // ==========================================

    async function loadDashboardStats() {
        try {
            const [companies, jobs, applications, students] =
                await Promise.all([
                    apiRequest("/companies"),
                    apiRequest("/jobs"),
                    apiRequest("/admin/applications"),
                    apiRequest("/admin/students")
                ]);

            document.getElementById("totalStudents").textContent =
                Array.isArray(students) ? students.length : 0;

            document.getElementById("totalCompanies").textContent =
                Array.isArray(companies) ? companies.length : 0;

            document.getElementById("totalJobs").textContent =
                Array.isArray(jobs) ? jobs.length : 0;

            document.getElementById("totalApplications").textContent =
                Array.isArray(applications) ? applications.length : 0;

        } catch (error) {
            console.error("Dashboard stats error:", error);
        }
    }

    async function loadRegisteredStudents() {
        const table = document.getElementById("studentsTable");
        const message = document.getElementById("studentsMessage");
    
        if (!table) return;
    
        table.innerHTML = "";
    
        try {
            const students = await apiRequest("/admin/students");
    
            if (!Array.isArray(students) || students.length === 0) {
                if (message) {
                    message.textContent = "No registered students found.";
                }
                return;
            }
    
            if (message) message.textContent = "";
    
            students.forEach(student => {
                const row = document.createElement("tr");
    
                const name = document.createElement("td");
                name.textContent = student.name || "—";
    
                const email = document.createElement("td");
                email.textContent = student.email || "—";
    
                const role = document.createElement("td");
                role.textContent = student.role || "student";
    
                const accountStatus = document.createElement("td");
                accountStatus.textContent = student.is_active
                    ? "Active"
                    : "Inactive";
    
                const action = document.createElement("td");
                action.textContent = "—";
    
                row.append(name, email, role, accountStatus, action);
                table.appendChild(row);
            });
        } catch (error) {
            console.error("Registered students error:", error);
    
            if (message) {
                message.textContent =
                    error.message || "Could not load registered students.";
            }
        }
    }

    // ==========================================
    // 6. INITIAL PAGE LOAD
    // ==========================================

    loadDashboardStats();
    loadApplications();
    loadCompanies();
    loadJobs();
    loadRegisteredStudents();
});