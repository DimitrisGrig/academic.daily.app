"""
Script to create the security_alerts table in the database.
Run this once to add the new security logging table.
"""
from database import engine
import models

def create_security_table():
    """Create security_alerts table"""
    print("Creating security_alerts table...")
    models.Base.metadata.create_all(bind=engine)
    print("✓ security_alerts table created successfully!")
    print("\nYou can now monitor security alerts with:")
    print("  SELECT * FROM security_alerts ORDER BY created_at DESC LIMIT 50;")

if __name__ == "__main__":
    create_security_table()
