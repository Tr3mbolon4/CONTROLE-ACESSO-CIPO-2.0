import asyncio
import json
import re
import sqlite3
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional


def _encode_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return {"__type__": "datetime", "value": value.isoformat()}
    if isinstance(value, dict):
        return {key: _encode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_encode_value(item) for item in value]
    return value


def _decode_value(value: Any) -> Any:
    if isinstance(value, dict):
        if value.get("__type__") == "datetime":
            return datetime.fromisoformat(value["value"])
        return {key: _decode_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_decode_value(item) for item in value]
    return value


def _matches_condition(value: Any, condition: Any) -> bool:
    if isinstance(condition, dict):
        regex_pattern = condition.get("$regex")
        if regex_pattern is not None:
            flags = re.IGNORECASE if "i" in condition.get("$options", "") else 0
            return re.search(regex_pattern, "" if value is None else str(value), flags) is not None

        if "$gte" in condition and (value is None or value < condition["$gte"]):
            return False
        if "$lte" in condition and (value is None or value > condition["$lte"]):
            return False
        return True

    return value == condition


def _matches_query(document: Dict[str, Any], query: Dict[str, Any]) -> bool:
    for key, condition in query.items():
        if key == "$or":
            if not any(_matches_query(document, branch) for branch in condition):
                return False
            continue

        if not _matches_condition(document.get(key), condition):
            return False

    return True


def _apply_projection(document: Dict[str, Any], projection: Optional[Dict[str, int]]) -> Dict[str, Any]:
    if not projection:
        return dict(document)

    result = dict(document)
    for key, flag in projection.items():
        if flag == 0:
            result.pop(key, None)
    return result


class InsertOneResult:
    def __init__(self, inserted_id: str):
        self.inserted_id = inserted_id


class UpdateResult:
    def __init__(self, matched_count: int, modified_count: int, upserted_id: Optional[str] = None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class DeleteResult:
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class SQLiteCursor:
    def __init__(self, collection: "SQLiteCollection", query: Dict[str, Any], projection: Optional[Dict[str, int]] = None):
        self.collection = collection
        self.query = query
        self.projection = projection
        self.sort_field = None
        self.sort_direction = 1
        self.skip_count = 0
        self.limit_count = None

    def sort(self, field: str, direction: int):
        self.sort_field = field
        self.sort_direction = direction
        return self

    def skip(self, count: int):
        self.skip_count = count
        return self

    def limit(self, count: int):
        self.limit_count = count
        return self

    async def to_list(self, length: int):
        docs = await self.collection._find_many(self.query, self.projection)

        if self.sort_field:
            reverse = self.sort_direction < 0
            docs.sort(
                key=lambda item: (item.get(self.sort_field) is None, item.get(self.sort_field)),
                reverse=reverse,
            )

        if self.skip_count:
            docs = docs[self.skip_count :]

        final_limit = self.limit_count if self.limit_count is not None else length
        if final_limit is not None:
            docs = docs[:final_limit]

        return docs


class SQLiteCollection:
    def __init__(self, database: "SQLiteDatabase", name: str):
        self.database = database
        self.name = name

    async def create_index(self, *_args, **_kwargs):
        return None

    def find(self, query: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, int]] = None) -> SQLiteCursor:
        return SQLiteCursor(self, query or {}, projection)

    async def _find_many(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None) -> List[Dict[str, Any]]:
        documents = await self.database._get_collection_documents(self.name)
        return [_apply_projection(doc, projection) for doc in documents if _matches_query(doc, query)]

    async def find_one(self, query: Dict[str, Any], projection: Optional[Dict[str, int]] = None) -> Optional[Dict[str, Any]]:
        documents = await self._find_many(query, projection)
        return documents[0] if documents else None

    async def insert_one(self, document: Dict[str, Any]) -> InsertOneResult:
        doc = dict(document)
        inserted_id = str(doc.get("_id") or uuid.uuid4())
        doc["_id"] = inserted_id
        await self.database._upsert_document(self.name, inserted_id, doc)
        return InsertOneResult(inserted_id)

    async def update_one(self, query: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        documents = await self.database._get_collection_documents(self.name)
        target = next((doc for doc in documents if _matches_query(doc, query)), None)

        if target is None:
            if not upsert:
                return UpdateResult(0, 0)

            target = {}
            for key, value in query.items():
                if not key.startswith("$") and not isinstance(value, dict):
                    target[key] = value

            inserted_id = str(target.get("_id") or uuid.uuid4())
            target["_id"] = inserted_id
            self._apply_update_ops(target, update)
            await self.database._upsert_document(self.name, inserted_id, target)
            return UpdateResult(0, 1, upserted_id=inserted_id)

        updated = dict(target)
        self._apply_update_ops(updated, update)
        await self.database._upsert_document(self.name, str(updated["_id"]), updated)
        return UpdateResult(1, 1)

    async def delete_one(self, query: Dict[str, Any]) -> DeleteResult:
        documents = await self.database._get_collection_documents(self.name)
        target = next((doc for doc in documents if _matches_query(doc, query)), None)
        if not target:
            return DeleteResult(0)

        await self.database._delete_document(self.name, str(target["_id"]))
        return DeleteResult(1)

    async def count_documents(self, query: Dict[str, Any]) -> int:
        documents = await self.database._get_collection_documents(self.name)
        return sum(1 for doc in documents if _matches_query(doc, query))

    @staticmethod
    def _apply_update_ops(document: Dict[str, Any], update: Dict[str, Any]) -> None:
        for operator, payload in update.items():
            if operator == "$set":
                for key, value in payload.items():
                    document[key] = value
            elif operator == "$inc":
                for key, value in payload.items():
                    document[key] = document.get(key, 0) + value
            elif operator == "$push":
                for key, value in payload.items():
                    document.setdefault(key, [])
                    document[key].append(value)
            else:
                raise NotImplementedError(f"Unsupported update operator: {operator}")


class SQLiteDatabase:
    def __init__(self, path: str):
        db_path = Path(path)
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(db_path, check_same_thread=False)
        self.connection.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                collection_name TEXT NOT NULL,
                id TEXT NOT NULL,
                data TEXT NOT NULL,
                PRIMARY KEY (collection_name, id)
            )
            """
        )
        self.connection.commit()
        self.lock = threading.Lock()
        self._collections: Dict[str, SQLiteCollection] = {}

    def __getattr__(self, item: str) -> SQLiteCollection:
        if item.startswith("_"):
            raise AttributeError(item)
        if item not in self._collections:
            self._collections[item] = SQLiteCollection(self, item)
        return self._collections[item]

    async def _get_collection_documents(self, collection_name: str) -> List[Dict[str, Any]]:
        return await asyncio.to_thread(self._get_collection_documents_sync, collection_name)

    def _get_collection_documents_sync(self, collection_name: str) -> List[Dict[str, Any]]:
        with self.lock:
            rows = self.connection.execute(
                "SELECT data FROM documents WHERE collection_name = ?",
                (collection_name,),
            ).fetchall()
        return [_decode_value(json.loads(row[0])) for row in rows]

    async def _upsert_document(self, collection_name: str, document_id: str, document: Dict[str, Any]) -> None:
        await asyncio.to_thread(self._upsert_document_sync, collection_name, document_id, document)

    def _upsert_document_sync(self, collection_name: str, document_id: str, document: Dict[str, Any]) -> None:
        payload = json.dumps(_encode_value(document), ensure_ascii=False)
        with self.lock:
            self.connection.execute(
                """
                INSERT INTO documents (collection_name, id, data)
                VALUES (?, ?, ?)
                ON CONFLICT(collection_name, id) DO UPDATE SET data = excluded.data
                """,
                (collection_name, document_id, payload),
            )
            self.connection.commit()

    async def _delete_document(self, collection_name: str, document_id: str) -> None:
        await asyncio.to_thread(self._delete_document_sync, collection_name, document_id)

    def _delete_document_sync(self, collection_name: str, document_id: str) -> None:
        with self.lock:
            self.connection.execute(
                "DELETE FROM documents WHERE collection_name = ? AND id = ?",
                (collection_name, document_id),
            )
            self.connection.commit()

    def close(self):
        with self.lock:
            self.connection.close()


def create_database(sqlite_path: str) -> tuple[SQLiteDatabase, SQLiteDatabase]:
    database = SQLiteDatabase(sqlite_path)
    return database, database
