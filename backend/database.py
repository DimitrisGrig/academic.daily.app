from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

#             PostgreSQL             #
db_host = os.getenv("db_host")
db_port = os.getenv("db_port")
db_name = os.getenv("db_name")
db_user = os.getenv("db_user")
db_password = os.getenv("db_password")

# URL-encode the password
encoded_password = quote_plus(db_password)

# Construct the SQLAlchemy database URL
SQLALCHEMY_DATABASE_URL = f"postgresql+psycopg2://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
engine = create_engine(SQLALCHEMY_DATABASE_URL,
                        pool_size=20,       # Number of connections to keep in the pool
                        max_overflow=10,    # Number of connections to allow beyond pool_size
                        pool_recycle=3600,  # Recycle connections after 1 hour (was 10 sec - caused issues)
                        pool_pre_ping=True, # Verify connections are alive before using (prevents stale connections)
                        pool_timeout=60,    # Timeout if a connection isn't available in 60 seconds
                        echo_pool=False     # Set to True for debugging connection pool issues
                        )
local_main = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_local_db():
    db = local_main()
    try:
        yield db
    finally:
        db.close()