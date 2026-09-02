import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import event

# Ensure database directory exists in backend/data
db_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, "options_oracle.db")

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")

# Normalize PostgreSQL URLs for async SQLAlchemy (Render environment variables provide postgresql:// or postgres://)
if DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql+asyncpg://"):
    import urllib.parse
    
    # Safe password encoding for passwords with '@', '!', '#', etc.
    scheme, rest = DATABASE_URL.split("://", 1)
    if "@" in rest:
        userinfo, hostinfo = rest.rsplit("@", 1)
        if ":" in userinfo:
            username, password = userinfo.split(":", 1)
            unquoted_pw = urllib.parse.unquote(password)
            encoded_pw = urllib.parse.quote(unquoted_pw, safe="")
            DATABASE_URL = f"{scheme}://{username}:{encoded_pw}@{hostinfo}"

    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

    parsed = urllib.parse.urlparse(DATABASE_URL)
    if parsed.query:
        qs = urllib.parse.parse_qs(parsed.query)
        clean_params = {}
        for k, v in qs.items():
            if k == 'sslmode':
                val = v[0] if v else ''
                if val in ['require', 'prefer']:
                    clean_params['ssl'] = ['require']
                elif val == 'no-verify':
                    clean_params['ssl'] = ['no-verify']
            elif k in ['ssl', 'timeout', 'command_timeout', 'server_settings']:
                clean_params[k] = v

        new_query = urllib.parse.urlencode(clean_params, doseq=True)
        DATABASE_URL = urllib.parse.urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

# Automatically ensure parent directory of DATABASE_URL exists and is writable to prevent sqlite connection errors
if DATABASE_URL.startswith("sqlite+aiosqlite:///"):
    db_file_path = DATABASE_URL.replace("sqlite+aiosqlite:///", "")
    parent_dir = os.path.dirname(db_file_path)
    if parent_dir:
        is_writable = False
        try:
            os.makedirs(parent_dir, exist_ok=True)
            # Test writing to directory to verify permissions
            test_file = os.path.join(parent_dir, ".write_test")
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            is_writable = True
        except Exception as e:
            print(f"[DB Session] Warning: database directory {parent_dir} is not writable or cannot be created: {e}")
            
        if not is_writable:
            print(f"[DB Session] Falling back to default database path: {db_path}")
            DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"

if "sqlite" in DATABASE_URL:
    engine = create_async_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()
else:
    engine = create_async_engine(DATABASE_URL, echo=False)

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

async def get_db():
    async with async_session() as session:
        yield session

