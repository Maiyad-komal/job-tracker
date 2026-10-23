from database import SessionLocal
from models import User

db = SessionLocal()

try:
    users = db.query(User).all()

    for user in users:
        print(
            f"ID: {user.id}, "
            f"Email: {user.email}, "
            f"Role: {user.role}, "
            f"Active: {user.is_active}"
        )
finally:
    db.close()