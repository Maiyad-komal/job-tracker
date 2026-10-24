document.addEventListener("DOMContentLoaded", () => {
    const API = (typeof API_URL !== "undefined" && API_URL)
        ? API_URL
        : "http://127.0.0.1:8000";

    const token = () => localStorage.getItem("access_token");
    const state = {
        companies: [],
        jobs: [],
        applications: [],
        students: []
    };
    const pages = { companies: 1, jobs: 1, applications: 1, students: 1 };
    const tables = {};

    const $ = id => document.getElementById(id);

    function message(id, text, error = false) {
        const element = $(id);
        if (!element) return;
        element.textContent = text;
        element.classList.toggle("error-message", error);
        element.classList.toggle("success-message", !error && !!text);
    }

    function cell(row, value) {
        const td = document.createElement("td");
        td.textContent = value ?? "—";
        row.appendChild(td);
        return td;
    }

    function makeButton(text, className, callback, disabled = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.className = className;
        button.disabled = disabled;
        button.addEventListener("click", callback);
        return button;
    }

    function statusBadge(value) {
        const span = document.createElement("span");
        const normalized = String(value || "").toLowerCase();
        span.className = "status-pill " +
            (["active", "open", "selected"].includes(normalized) ? "status-green" :
            ["shortlisted", "under review"].includes(normalized) ? "status-blue" :
            ["inactive", "closed", "rejected"].includes(normalized) ? "status-red" :
            "status-orange");
        span.textContent = value || "Applied";
        return span;
    }

    async function apiRequest(path, options = {}) {
        const headers = {
            ...(options.headers || {}),
            Authorization: `Bearer ${token()}`
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

        if (response.status === 401) {
            localStorage.removeItem("access_token");
            alert("Your session has expired. Please log in again.");
            window.location.href = "login.html";
            throw new Error("Session expired.");
        }

        if (response.status === 403) {
            throw new Error("Access denied. Please use an admin account.");
        }

        if (!response.ok) {
            throw new Error(
                typeof data?.detail === "string"
                    ? data.detail
                    : data?.detail
                        ? JSON.stringify(data.detail)
                        : `Request failed (${response.status})`
            );
        }

        return data;
    }

    function jsonOptions(method, body) {
        return {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        };
    }

    function setTable(key, tbodyId, pageSizeId, paginationId, colSpan, renderer) {
        tables[key] = {
            tbodyId, pageSizeId, paginationId, colSpan, renderer, data: []
        };
    }

    function renderTable(key, newData) {
        const config = tables[key];
        if (!config) return;

        if (newData !== undefined) config.data = newData;

        const tbody = $(config.tbodyId);
        const pagination = $(config.paginationId);
        const size = Number($(config.pageSizeId)?.value || 5);
        const total = config.data.length;
        const totalPages = Math.max(1, Math.ceil(total / size));

        pages[key] = Math.min(pages[key], totalPages);
        pages[key] = Math.max(1, pages[key]);

        tbody.replaceChildren();

        if (total === 0) {
            const row = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = config.colSpan;
            td.className = "empty-cell";
            td.textContent = "No records found.";
            row.appendChild(td);
            tbody.appendChild(row);
        } else {
            const start = (pages[key] - 1) * size;
            config.data.slice(start, start + size).forEach(item => {
                tbody.appendChild(config.renderer(item));
            });
        }

        pagination.replaceChildren();

        const info = document.createElement("span");
        info.className = "pagination-info";
        info.textContent = total
            ? `${(pages[key] - 1) * size + 1}–${Math.min(pages[key] * size, total)} of ${total}`
            : "0 records";

        const controls = document.createElement("div");
        controls.className = "pagination-controls";

        const previous = makeButton("← Previous", "page-button",
            () => { pages[key]--; renderTable(key); }, pages[key] <= 1);

        const next = makeButton("Next →", "page-button",
            () => { pages[key]++; renderTable(key); }, pages[key] >= totalPages);

        const pageLabel = document.createElement("span");
        pageLabel.className = "page-number";
        pageLabel.textContent = `Page ${pages[key]} of ${totalPages}`;

        controls.append(previous, pageLabel, next);
        pagination.append(info, controls);
    }

    function refreshCompanies() {
        const query = ($("companiesSearch")?.value || "").trim().toLowerCase();
        renderTable("companies", state.companies.filter(company =>
            [company.name, company.website, company.location]
                .some(value => String(value || "").toLowerCase().includes(query))
        ));
    }

    function refreshJobs() {
        const query = ($("jobsSearch")?.value || "").trim().toLowerCase();
        const status = $("jobsStatusFilter")?.value || "";
        renderTable("jobs", state.jobs.filter(job => {
            const matchesQuery = [
                job.title, job.company_name, job.location, job.job_type
            ].some(value => String(value || "").toLowerCase().includes(query));
            const matchesStatus = !status ||
                (status === "open" ? job.is_active : !job.is_active);
            return matchesQuery && matchesStatus;
        }));
    }

    function refreshApplications() {
        const query = ($("applicationsSearch")?.value || "").trim().toLowerCase();
        const status = ($("applicationFilter")?.value || "").toLowerCase();
        renderTable("applications", state.applications.filter(app => {
            const matchesQuery = [
                app.student_name, app.student_email, app.company_name, app.job_title
            ].some(value => String(value || "").toLowerCase().includes(query));
            const currentStatus = String(app.status || "Applied").toLowerCase();
            const matchesStatus = !status || currentStatus === status;
            return matchesQuery && matchesStatus;
        }));
    }

    function refreshStudents() {
        const query = ($("studentsSearch")?.value || "").trim().toLowerCase();
        const status = $("studentsStatusFilter")?.value || "";
        renderTable("students", state.students.filter(student => {
            const matchesQuery = [student.name, student.email]
                .some(value => String(value || "").toLowerCase().includes(query));
            const matchesStatus = !status ||
                (status === "active" ? student.is_active : !student.is_active);
            return matchesQuery && matchesStatus;
        }));
    }

    function updateStats() {
        $("totalStudents").textContent = state.students.length;
        $("totalCompanies").textContent =
            state.companies.filter(company => company.is_active).length;
        $("totalJobs").textContent =
            state.jobs.filter(job => job.is_active).length;
        $("totalApplications").textContent = state.applications.length;
    }

    async function loadCompanies() {
        try {
            state.companies = await apiRequest("/admin/companies");
            if (!Array.isArray(state.companies)) state.companies = [];

            const dropdown = $("jobCompany");
            const previous = dropdown.value;
            dropdown.replaceChildren(new Option("Select a company", ""));

            state.companies.filter(company => company.is_active).forEach(company => {
                dropdown.add(new Option(company.name, company.id));
            });

            if ([...dropdown.options].some(option => option.value === previous)) {
                dropdown.value = previous;
            }

            refreshCompanies();
            updateStats();
            message("companiesMessage", "");
        } catch (error) {
            message("companiesMessage", error.message, true);
            renderTable("companies", []);
        }
    }

    async function loadJobs() {
        try {
            state.jobs = await apiRequest("/admin/jobs");
            if (!Array.isArray(state.jobs)) state.jobs = [];
            refreshJobs();
            updateStats();
            message("jobsMessage", "");
        } catch (error) {
            message("jobsMessage", error.message, true);
            renderTable("jobs", []);
        }
    }

    async function loadApplications() {
        try {
            state.applications = await apiRequest("/admin/applications");
            if (!Array.isArray(state.applications)) state.applications = [];
            refreshApplications();
            updateStats();
            message("applicationsMessage", "");
        } catch (error) {
            message("applicationsMessage", error.message, true);
            renderTable("applications", []);
        }
    }

    async function loadStudents() {
        try {
            state.students = await apiRequest("/admin/students");
            if (!Array.isArray(state.students)) state.students = [];
            refreshStudents();
            updateStats();
            message("studentsMessage", "");
        } catch (error) {
            message("studentsMessage", error.message, true);
            renderTable("students", []);
        }
    }

    // Company rows
    function companyRow(company) {
        const row = document.createElement("tr");
        cell(row, company.name);

        const websiteCell = document.createElement("td");
        if (company.website) {
            const link = document.createElement("a");
            link.href = company.website;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "Visit website ↗";
            websiteCell.appendChild(link);
        } else {
            websiteCell.textContent = "—";
        }
        row.appendChild(websiteCell);
        cell(row, company.location || "—");
        const statusCell = document.createElement("td");
        statusCell.appendChild(statusBadge(company.is_active ? "Active" : "Inactive"));
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        actionCell.appendChild(makeButton("Delete", "danger-button", async () => {
            if (!confirm(`Delete company "${company.name}"?`)) return;
            try {
                await apiRequest(`/admin/companies/${company.id}`, { method: "DELETE" });
                message("companyMessage", "Company deleted successfully.");
                await loadCompanies();
                await loadDashboardStats();
            } catch (error) {
                message("companiesMessage", error.message, true);
            }
        }));
        row.appendChild(actionCell);
        return row;
    }

    // Job rows
    function jobRow(job) {
        const row = document.createElement("tr");
        cell(row, job.title);
        cell(row, job.company_name);
        cell(row, job.location || "—");
        cell(row, job.job_type || "—");

        let deadline = "—";
        if (job.deadline) {
            const date = new Date(job.deadline);
            if (!Number.isNaN(date.getTime())) deadline = date.toLocaleDateString();
        }
        cell(row, deadline);

        const statusCell = document.createElement("td");
        statusCell.appendChild(statusBadge(job.is_active ? "Open" : "Closed"));
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        actionCell.appendChild(makeButton(
            job.is_active ? "Close Job" : "Closed",
            job.is_active ? "danger-button" : "secondary-button",
            async () => {
                if (!confirm(`Close "${job.title}"? Students will no longer see this opening.`)) return;
                try {
                    await apiRequest(`/admin/jobs/${job.id}`, { method: "DELETE" });
                    message("jobsMessage", "Job closed successfully.");
                    await loadJobs();
                    await loadDashboardStats();
                } catch (error) {
                    message("jobsMessage", error.message, true);
                }
            },
            !job.is_active
        ));
        row.appendChild(actionCell);
        return row;
    }

    // Application rows
    function applicationRow(app) {
        const row = document.createElement("tr");
        cell(row, app.student_name);
        cell(row, app.student_email);
        cell(row, app.company_name);
        cell(row, app.job_title);

        const resumeCell = document.createElement("td");
        if (app.resume_path) {
            const link = document.createElement("a");
            link.href = app.resume_path.startsWith("http")
                ? app.resume_path
                : `${API}${app.resume_path.startsWith("/") ? "" : "/"}${app.resume_path}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "View resume ↗";
            resumeCell.appendChild(link);
        } else {
            resumeCell.textContent = "Not uploaded";
        }
        row.appendChild(resumeCell);

        const statusCell = document.createElement("td");
        statusCell.appendChild(statusBadge(app.status));
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        actionCell.className = "status-action-cell";

        const select = document.createElement("select");
        [
            "Applied", "Under Review", "Shortlisted", "Selected", "Rejected"
        ].forEach(value => select.add(new Option(value, value)));

        const match = [...select.options].find(
            option => option.value.toLowerCase() === String(app.status || "Applied").toLowerCase()
        );
        select.value = match ? match.value : "Applied";

        const updateButton = makeButton("Save", "small-primary-button", async () => {
            updateButton.disabled = true;
            try {
                await apiRequest(
                    `/admin/applications/${app.id}/status`,
                    jsonOptions("PUT", { status: select.value })
                );
                message("applicationsMessage", "Application status updated.");
                await loadApplications();
                await loadDashboardStats();
            } catch (error) {
                message("applicationsMessage", error.message, true);
            } finally {
                updateButton.disabled = false;
            }
        });

        actionCell.append(select, updateButton);
        row.appendChild(actionCell);
        return row;
    }

    // Student rows
    function studentRow(student) {
        const row = document.createElement("tr");
        cell(row, student.name);
        cell(row, student.email);
        cell(row, student.role);

        const statusCell = document.createElement("td");
        statusCell.appendChild(statusBadge(student.is_active ? "Active" : "Inactive"));
        row.appendChild(statusCell);

        const actionCell = document.createElement("td");
        actionCell.appendChild(makeButton(
            student.is_active ? "Deactivate" : "Activate",
            student.is_active ? "danger-button" : "small-primary-button",
            async () => {
                const action = student.is_active ? "deactivate" : "activate";
                if (!confirm(`Are you sure you want to ${action} ${student.name}'s account?`)) return;
                try {
                    await apiRequest(
                        `/admin/users/${student.id}`,
                        jsonOptions("PUT", { is_active: !student.is_active })
                    );
                    message("studentsMessage", `Student account ${action}d successfully.`);
                    await loadStudents();
                } catch (error) {
                    message("studentsMessage", error.message, true);
                }
            }
        ));
        row.appendChild(actionCell);
        return row;
    }

    // Set up paginated tables
    setTable("companies", "companiesTable", "companiesPageSize", "companiesPagination", 5, companyRow);
    setTable("jobs", "jobsTable", "jobsPageSize", "jobsPagination", 7, jobRow);
    setTable("applications", "applicationsTable", "applicationsPageSize", "applicationsPagination", 7, applicationRow);
    setTable("students", "studentsTable", "studentsPageSize", "studentsPagination", 5, studentRow);

    // Tabs
    document.querySelectorAll(".nav-item[data-tab]").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
            document.querySelectorAll(".tab-panel").forEach(panel => panel.hidden = true);
            button.classList.add("active");
            const panel = $(button.dataset.tab);
            if (panel) panel.hidden = false;
        });
    });

    // Search/filter events
    $("companiesSearch").addEventListener("input", () => { pages.companies = 1; refreshCompanies(); });
    $("jobsSearch").addEventListener("input", () => { pages.jobs = 1; refreshJobs(); });
    $("jobsStatusFilter").addEventListener("change", () => { pages.jobs = 1; refreshJobs(); });
    $("applicationsSearch").addEventListener("input", () => { pages.applications = 1; refreshApplications(); });
    $("applicationFilter").addEventListener("change", () => { pages.applications = 1; refreshApplications(); });
    $("studentsSearch").addEventListener("input", () => { pages.students = 1; refreshStudents(); });
    $("studentsStatusFilter").addEventListener("change", () => { pages.students = 1; refreshStudents(); });

    Object.keys(tables).forEach(key => {
        $(tables[key].pageSizeId).addEventListener("change", () => {
            pages[key] = 1;
            renderTable(key);
        });
    });

    // Add company
    $("companyForm").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.submitter;
        button.disabled = true;
        message("companyMessage", "Adding company...");

        try {
            await apiRequest("/admin/companies", jsonOptions("POST", {
                name: $("companyName").value.trim(),
                description: $("companyDescription").value.trim() || null,
                website: $("companyWebsite").value.trim() || null,
                location: $("companyLocation").value.trim() || null
            }));

            $("companyForm").reset();
            message("companyMessage", "Company added successfully.");
            await loadCompanies();
            await loadDashboardStats();
        } catch (error) {
            message("companyMessage", error.message, true);
        } finally {
            button.disabled = false;
        }
    });

    // Add job
    $("jobForm").addEventListener("submit", async event => {
        event.preventDefault();
        const button = event.submitter;
        button.disabled = true;
        message("jobMessage", "Posting job...");

        const deadline = $("jobDeadline").value;
        const jobData = {
            title: $("jobTitle").value.trim(),
            company_id: Number($("jobCompany").value),
            description: $("jobDescription").value.trim() || null,
            location: $("jobLocation").value.trim() || null,
            job_type: $("jobType").value || "Full-time",
            salary: $("jobSalary").value.trim() || null,
            deadline: deadline ? `${deadline}T23:59:00` : null
        };

        try {
            await apiRequest("/admin/jobs", jsonOptions("POST", jobData));
            $("jobForm").reset();
            message("jobMessage", "Job posted successfully.");
            await loadCompanies();
            await loadJobs();
            await loadDashboardStats();
        } catch (error) {
            message("jobMessage", error.message, true);
        } finally {
            button.disabled = false;
        }
    });

    $("logoutButton").addEventListener("click", () => {
        localStorage.removeItem("access_token");
        window.location.href = "login.html";
    });

    async function loadDashboardStats() {
        try {
            const [companies, jobs, applications, students] = await Promise.all([
                apiRequest("/admin/companies"),
                apiRequest("/admin/jobs"),
                apiRequest("/admin/applications"),
                apiRequest("/admin/students")
            ]);

            $("totalStudents").textContent = students.length;
            $("totalCompanies").textContent = companies.filter(item => item.is_active).length;
            $("totalJobs").textContent = jobs.filter(item => item.is_active).length;
            $("totalApplications").textContent = applications.length;
        } catch (error) {
            console.error("Dashboard stats error:", error);
        }
    }

    if (!token()) {
        alert("Please log in first.");
        window.location.href = "login.html";
        return;
    }

    // Load each section; one failure won't stop the other sections.
    loadCompanies();
    loadJobs();
    loadApplications();
    loadStudents();
    loadDashboardStats();
});