from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="student", nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    profile = relationship(
        "StudentProfile",
        back_populates="user",
        uselist=False
    )
    applications = relationship("Application", back_populates="student")


class StudentProfile(Base):
    __tablename__ = "student_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    phone = Column(String(20))
    course = Column(String(100))
    graduation_year = Column(Integer)
    resume_path = Column(String(500))

    user = relationship("User", back_populates="profile")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text)
    website = Column(String(255))
    location = Column(String(150))
    is_active = Column(Boolean, default=True)

    jobs = relationship("Job", back_populates="company")


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text)
    location = Column(String(150))
    job_type = Column(String(50))
    salary = Column(String(100))
    deadline = Column(DateTime(timezone=True))
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("Company", back_populates="jobs")
    applications = relationship("Application", back_populates="job")


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    status = Column(String(30), default="Applied", nullable=False)
    cover_letter = Column(Text)
    applied_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("User", back_populates="applications")
    job = relationship("Job", back_populates="applications")

    __table_args__ = (
        UniqueConstraint(
            "student_id", "job_id",
            name="unique_student_job"
        ),
    )