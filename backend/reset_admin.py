from getpass import getpass
from database import SessionLocal
from models import User
from auth import hash_password

db = SessionLocal()

try:
    user = db.query(User).filter(User.email == "komal@123").first()

    if not user:
        print("Admin account not found.")
    else:
        password = getpass("Enter new admin password: ")
        if len(password) < 8:
            print("Password must be at least 8 characters.")
        else:
            user.hashed_password = hash_password(password)
            user.role = "admin"
            user.is_active = True
            db.commit()
            print("Admin password reset successfully.")
finally:
    db.close()