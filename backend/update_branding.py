from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import DATABASE_URL
from app.models import CollegeSettings

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

s = db.query(CollegeSettings).first()
if not s:
    s = CollegeSettings(college_name="The Language Studio", logo_url="/lcs-logo.png", attendance_threshold=75)
    db.add(s)
    print("Database updated: Created default settings row (The Language Studio, /lcs-logo.png)")
else:
    s.college_name = "The Language Studio"
    s.logo_url = "/lcs-logo.png"
    print("Database updated: Updated existing settings row to The Language Studio, /lcs-logo.png")
db.commit()
db.close()
