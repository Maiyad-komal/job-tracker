from dotenv import load_dotenv
load_dotenv()

from database import Base, engine, SessionLocal
from models import User
from auth import hash_password


def create_admin():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        email = input("Admin email: ").strip().lower()
        name = input("Admin name: ").strip()
        password = input("Admin password: ")

        existing = db.query(User).filter(User.email == email).first()

        if existing:
            print("This email is already registered.")
            return

        admin = User(
            name=name,
            email=email,
            hashed_password=hash_password(password),
            role="admin",
            is_active=True,
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully!")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()