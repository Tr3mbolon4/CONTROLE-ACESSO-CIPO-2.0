import asyncio
import tempfile
from datetime import datetime, timezone
from pathlib import Path
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.local_db import create_database


async def main():
    db_file = tempfile.gettempdir() + rf"\portaria_sqlite_smoke_{uuid.uuid4().hex}.sqlite"
    client, db = create_database(db_file)

    await db.users.insert_one(
        {
            "email": "admin@portaria.com",
            "role": "admin",
            "created_at": datetime(2026, 5, 8, tzinfo=timezone.utc),
        }
    )
    await db.users.update_one(
        {"email": "admin@portaria.com"},
        {
            "$set": {"name": "Administrador"},
            "$inc": {"login_count": 1},
            "$push": {"tags": "seed"},
        },
    )

    user = await db.users.find_one({"email": "admin@portaria.com"})
    assert user["name"] == "Administrador"
    assert user["login_count"] == 1
    assert user["tags"] == ["seed"]

    regex_matches = await db.users.find(
        {"email": {"$regex": "PORTARIA", "$options": "i"}}
    ).to_list(10)
    assert len(regex_matches) == 1

    count = await db.users.count_documents(
        {"created_at": {"$gte": datetime(2026, 1, 1, tzinfo=timezone.utc)}}
    )
    assert count == 1

    client.close()
    print("SQLite smoke test passed.")


if __name__ == "__main__":
    asyncio.run(main())
