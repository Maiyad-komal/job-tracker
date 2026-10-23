import shutil
from pathlib import Path
from uuid import uuid4
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

from fastapi import (
    FastAPI, Depends, HTTPException, UploadFile, File, Form, status
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from database import Base, engine, get_db
from models import User, StudentProfile, Company, Job, Application
from schemas import (
    RegisterRequest,
    ProfileUpdate,
    ProfileResponse,
    CompanyCreate,
    JobCreate,
    ApplicationStatusUpdate,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_admin,
)

# --------------------------------------------------
# APP SETUP
# --------------------------------------------------

app = FastAPI(
    title="Job Tracker - Student Placement Portal",
    description="Student placement and job application management system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Use an absolute path based on this file's directory
BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads" / "resumes"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# URL /uploads/resumes/example.pdf maps to uploads/resumes/example.pdf
app.mount(
    "/uploads",
    StaticFiles(directory=str(BASE_DIR / "uploads")),
    name="uploads",
)


# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def user_details(user):
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
    }


def get_or_create_profile(db: Session, user_id: int):
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.user_id == user_id)
        .first()
    )

    if profile is None:
        profile = StudentProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


def company_details(company):
    return {
        "id": company.id,
        "name": company.name,
        "description": company.description,
        "website": company.website,
        "location": company.location,
        "is_active": company.is_active,
    }


def job_details(job):
    return {
        "id": job.id,
        "title": job.title,
        "description": job.description,
        "location": job.location,
        "job_type": job.job_type,
        "salary": job.salary,
        "deadline": job.deadline,
        "company_id": job.company_id,
        "company_name": job.company.name if job.company else None,
        "is_active": job.is_active,
        "is_open": job.is_active,
        "required_skills": "",
        "eligibility": "",
    }


def application_details(application):
    job = application.job
    student = application.student
    profile = student.profile if student else None

    return {
        "id": application.id,
        "student_id": application.student_id,
        "student_name": student.name if student else None,
        "student_email": student.email if student else None,
        "job_id": application.job_id,
        "job_title": job.title if job else None,
        "company_name": (
            job.company.name if job and job.company else None
        ),
        "status": application.status,
        "cover_letter": application.cover_letter,
        "applied_at": application.applied_at,
        "resume_path": profile.resume_path if profile else None,
    }


class UserActiveUpdate(BaseModel):
    is_active: bool


# --------------------------------------------------
# HOME AND HEALTH
# --------------------------------------------------

@app.get("/")
def home():
    return {"message": "Job Tracker API is working!"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
):
    existing_user = (
        db.query(User)
        .filter(User.email == str(request.email).lower())
        .first()
    )

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="This email is already registered.",
        )

    user = User(
        name=request.name.strip(),
        email=str(request.email).lower(),
        hashed_password=hash_password(request.password),
        role="student",
        is_active=True,
    )

    try:
        db.add(user)
        db.commit()
        db.refresh(user)
        get_or_create_profile(db, user.id)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unable to register with this email.",
        )

    return {
        "message": "Registration successful. Please log in.",
        "user": user_details(user),
    }


@app.post("/auth/login")
def login(
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    email = username.strip().lower()

    user = db.query(User).filter(User.email == email).first()

    if (
        user is None
        or not verify_password(password, user.hashed_password)
        or not user.is_active
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password, or account is inactive.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
        "user": user_details(user),
    }


@app.get("/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return user_details(user)


# --------------------------------------------------
# STUDENT PROFILE
# --------------------------------------------------

@app.get("/student/profile", response_model=ProfileResponse)
def get_student_profile(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")

    return get_or_create_profile(db, user.id)


@app.put("/student/profile", response_model=ProfileResponse)
def update_student_profile(
    request: ProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")

    profile = get_or_create_profile(db, user.id)

    for field, value in request.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


# --------------------------------------------------
# RESUME UPLOAD
# --------------------------------------------------

@app.post("/student/resume")
def upload_resume(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")

    if not file.filename or Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF resumes are allowed.",
        )

    profile = get_or_create_profile(db, user.id)
    filename = f"{user.id}_{uuid4().hex}.pdf"
    file_path = UPLOAD_DIR / filename

    try:
        with file.file as source:
            with file_path.open("wb") as destination:
                shutil.copyfileobj(source, destination)

        profile.resume_path = f"/uploads/resumes/{filename}"
        db.commit()
        db.refresh(profile)

        return {
            "message": "Resume uploaded successfully.",
            "resume_path": profile.resume_path,
        }

    except Exception:
        db.rollback()
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="Could not save the resume.",
        )


# --------------------------------------------------
# COMPANIES
# --------------------------------------------------

@app.get("/companies")
def list_companies(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    companies = (
        db.query(Company)
        .filter(Company.is_active.is_(True))
        .order_by(Company.name)
        .all()
    )
    return [company_details(company) for company in companies]


@app.post("/admin/companies", status_code=status.HTTP_201_CREATED)
def create_company(
    request: CompanyCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    company = Company(**request.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    return company_details(company)


@app.delete("/admin/companies/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    company = db.query(Company).filter(Company.id == company_id).first()

    if company is None:
        raise HTTPException(status_code=404, detail="Company not found.")

    if company.jobs:
        raise HTTPException(
            status_code=400,
            detail="This company has jobs. Remove its jobs before deleting it.",
        )

    db.delete(company)
    db.commit()
    return {"message": "Company deleted successfully."}


# --------------------------------------------------
# JOBS
# --------------------------------------------------

@app.get("/jobs")
def list_jobs(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    jobs = (
        db.query(Job)
        .join(Company)
        .filter(
            Job.is_active.is_(True),
            Company.is_active.is_(True),
        )
        .order_by(Job.created_at.desc())
        .all()
    )
    return [job_details(job) for job in jobs]


@app.post("/admin/jobs", status_code=status.HTTP_201_CREATED)
def create_job(
    request: JobCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    company = (
        db.query(Company)
        .filter(
            Company.id == request.company_id,
            Company.is_active.is_(True),
        )
        .first()
    )

    if company is None:
        raise HTTPException(status_code=404, detail="Company not found.")

    job = Job(**request.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job_details(job)


@app.delete("/admin/jobs/{job_id}")
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    job = db.query(Job).filter(Job.id == job_id).first()

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    if job.applications:
        raise HTTPException(
            status_code=400,
            detail="This job has applications. Close the job instead of deleting it.",
        )

    job.is_active = False
    db.commit()
    return {"message": "Job closed successfully."}


# --------------------------------------------------
# STUDENT APPLICATIONS
# --------------------------------------------------

@app.post("/jobs/{job_id}/apply", status_code=status.HTTP_201_CREATED)
def apply_for_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")

    job = (
        db.query(Job)
        .filter(Job.id == job_id, Job.is_active.is_(True))
        .first()
    )

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or closed.")

    if job.deadline:
        now = (
            datetime.now(job.deadline.tzinfo)
            if job.deadline.tzinfo
            else datetime.now()
        )
        if job.deadline < now:
            raise HTTPException(
                status_code=400,
                detail="Application deadline has passed.",
            )

    existing = (
        db.query(Application)
        .filter(
            Application.student_id == user.id,
            Application.job_id == job_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=409,
            detail="You have already applied for this job.",
        )

    application = Application(
        student_id=user.id,
        job_id=job_id,
        status="Applied",
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return {
        "message": "Application submitted successfully.",
        "application": application_details(application),
    }


@app.get("/student/applications")
def get_student_applications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access required.")

    applications = (
        db.query(Application)
        .filter(Application.student_id == user.id)
        .order_by(Application.applied_at.desc())
        .all()
    )
    return [application_details(app) for app in applications]


# --------------------------------------------------
# ADMIN: APPLICATIONS
# --------------------------------------------------

@app.get("/admin/applications")
def get_all_applications(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    applications = (
        db.query(Application)
        .order_by(Application.applied_at.desc())
        .all()
    )
    return [application_details(app) for app in applications]

@app.get("/admin/students")
def get_all_students(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    students = (
        db.query(User)
        .filter(User.role == "student")
        .order_by(User.created_at.desc())
        .all()
    )

    return [
        {
            "id": student.id,
            "name": student.name,
            "email": student.email,
            "role": student.role,
            "is_active": student.is_active,
        }
        for student in students
    ]


@app.put("/admin/applications/{application_id}/status")
def update_application_status(
    application_id: int,
    request: ApplicationStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    allowed_statuses = {
        "applied": "Applied",
        "pending": "Under Review",
        "under review": "Under Review",
        "shortlisted": "Shortlisted",
        "selected": "Selected",
        "rejected": "Rejected",
    }

    new_status = allowed_statuses.get(request.status.strip().lower())

    if new_status is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Choose Applied, Under Review, Shortlisted, Selected or Rejected.",
        )

    application = (
        db.query(Application)
        .filter(Application.id == application_id)
        .first()
    )

    if application is None:
        raise HTTPException(status_code=404, detail="Application not found.")

    application.status = new_status
    db.commit()
    db.refresh(application)

    return {
        "message": "Application status updated.",
        "application": application_details(application),
    }


# --------------------------------------------------
# ADMIN: USERS
# --------------------------------------------------

@app.get("/admin/users")
def get_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [user_details(user) for user in users]


@app.put("/admin/users/{user_id}")
def update_user_status(
    user_id: int,
    request: UserActiveUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()

    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    if user.id == admin.id and not request.is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own admin account.",
        )

    user.is_active = request.is_active
    db.commit()
    db.refresh(user)

    return {
        "message": "User account status updated.",
        "user": user_details(user),
    }