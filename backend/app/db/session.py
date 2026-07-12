import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import event

# Ensure database directory exists in backend/data
db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, "options_oracle.db")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")

# Automatically ensure parent directory of DATABASE_URL exists to prevent sqlite connection errors
if DATABASE_URL.startswith("sqlite+aiosqlite:///"):
    db_file_path = DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    parent_dir = os.path.dirname(db_file_path)
    if parent_dir:
        try:
            os.makedirs(parent_dir, exist_ok=True)
        except Exception as e:
            print(f"[DB Session] Warning: could not create parent directory {parent_dir}: {e}")

engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with async_session() as session:
        yield session

