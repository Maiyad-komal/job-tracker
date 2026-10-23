from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    course: Optional[str] = None
    graduation_year: Optional[int] = None


class ProfileResponse(BaseModel):
    id: int
    user_id: int
    phone: Optional[str] = None
    course: Optional[str] = None
    graduation_year: Optional[int] = None
    resume_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CompanyCreate(BaseModel):
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None


class CompanyResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    website: Optional[str] = None
    location: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class JobCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary: Optional[str] = None
    deadline: Optional[datetime] = None
    company_id: int


class JobResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary: Optional[str] = None
    deadline: Optional[datetime] = None
    company_id: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class ApplicationResponse(BaseModel):
    id: int
    student_id: int
    job_id: int
    status: str
    cover_letter: Optional[str] = None
    applied_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ApplicationStatusUpdate(BaseModel):
    status: str