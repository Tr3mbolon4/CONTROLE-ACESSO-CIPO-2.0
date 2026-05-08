from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Query, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import bcrypt
import jwt
import uuid
import requests
import io
import mimetypes
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Any
from contextlib import asynccontextmanager
from backend.local_db import create_database

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Brazil timezone
BR_TZ = ZoneInfo("America/Sao_Paulo")

def get_brazil_now():
    """Retorna datetime atual no horário de Brasília"""
    return datetime.now(BR_TZ)


def get_brazil_today() -> str:
    return get_brazil_now().strftime("%Y-%m-%d")


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/",
    )

def ObjectId(value: Any) -> str:
    return str(value)

# Local database connection
BASE_DIR = Path(__file__).resolve().parent
SQLITE_PATH = os.environ.get("SQLITE_PATH", str(BASE_DIR / "data" / "portaria.db"))
client, db = create_database(SQLITE_PATH)

# JWT Configuration
JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-key-change-in-production-64chars")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MAX_AGE = int(os.environ.get("ACCESS_TOKEN_MAX_AGE", str(8 * 60 * 60)))
REFRESH_TOKEN_MAX_AGE = int(os.environ.get("REFRESH_TOKEN_MAX_AGE", str(7 * 24 * 60 * 60)))
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax")

# Object Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "portaria-acesso"
STORAGE_BACKEND = os.environ.get("STORAGE_BACKEND", "local").lower()
LOCAL_STORAGE_DIR = Path(os.environ.get("LOCAL_STORAGE_DIR", str(BASE_DIR / "uploads")))
storage_key = None

# ================== HELPER FUNCTIONS ==================

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return JWT_SECRET

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def serialize_doc(doc: dict) -> dict:
    """Convert stored documents to JSON-serializable dict"""
    if doc is None:
        return None
    result = {}
    for key, value in doc.items():
        if key == "_id":
            result["id"] = str(value)
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [serialize_doc(v) if isinstance(v, dict) else v for v in value]
        elif isinstance(value, dict):
            result[key] = serialize_doc(value)
        else:
            result[key] = value
    return result

# ================== OBJECT STORAGE ==================

def init_storage():
    if STORAGE_BACKEND == "local":
        LOCAL_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        return "local-storage"
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set, storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        logger.info("Storage initialized successfully")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    if STORAGE_BACKEND == "local":
        init_storage()
        file_path = LOCAL_STORAGE_DIR / Path(path)
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_bytes(data)
        return {
            "path": path,
            "storage_backend": "local",
            "content_type": content_type,
            "size": len(data),
        }

    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    if STORAGE_BACKEND == "local":
        file_path = LOCAL_STORAGE_DIR / Path(path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Stored file not found")
        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        return file_path.read_bytes(), content_type

    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def delete_object(path: str) -> None:
    if STORAGE_BACKEND == "local":
        file_path = LOCAL_STORAGE_DIR / Path(path)
        if file_path.exists():
            file_path.unlink()
        return

    key = init_storage()
    if not key:
        return
    requests.delete(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )

# ================== AUTH HELPERS ==================

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        token = request.query_params.get("auth")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return serialize_doc(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_role(user: dict, allowed_roles: List[str]):
    if user.get("role") not in allowed_roles:
        raise HTTPException(status_code=403, detail="Access denied")

# ================== PYDANTIC MODELS ==================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "portaria"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    password: Optional[str] = None

class VisitorCreate(BaseModel):
    nome: str
    placa: Optional[str] = None
    veiculo: Optional[str] = None
    observacao: Optional[str] = None

class VisitorUpdate(BaseModel):
    nome: Optional[str] = None
    placa: Optional[str] = None
    veiculo: Optional[str] = None
    observacao: Optional[str] = None
    hora_saida: Optional[str] = None

class FleetCreate(BaseModel):
    carro: str
    placa: str
    motorista: str
    destino: str
    km_saida: float
    observacao: Optional[str] = None

class FleetReturn(BaseModel):
    km_retorno: float
    observacao: Optional[str] = None

class EmployeeCreate(BaseModel):
    nome: str
    setor: str
    responsavel: Optional[str] = None
    autorizado: bool = True
    placa: Optional[str] = None
    observacao: Optional[str] = None

class EmployeeUpdate(BaseModel):
    nome: Optional[str] = None
    setor: Optional[str] = None
    responsavel: Optional[str] = None
    autorizado: Optional[bool] = None
    placa: Optional[str] = None
    hora_saida: Optional[str] = None
    observacao: Optional[str] = None

class DirectorCreate(BaseModel):
    nome: str
    placa: Optional[str] = None
    carro: Optional[str] = None
    observacao: Optional[str] = None

class DirectorUpdate(BaseModel):
    nome: Optional[str] = None
    placa: Optional[str] = None
    carro: Optional[str] = None
    hora_saida_almoco: Optional[str] = None
    hora_retorno_almoco: Optional[str] = None
    hora_saida: Optional[str] = None
    observacao: Optional[str] = None

# ================== CARREGAMENTO MODELS ==================

class CarregamentoCreate(BaseModel):
    placa_carreta: str
    placa_cavalo: str
    cubagem: Optional[str] = None
    motorista: str
    empresa_terceirizada: str
    destino: str
    observacao: Optional[str] = None
    agendamento_id: Optional[str] = None

class CarregamentoUpdate(BaseModel):
    placa_carreta: Optional[str] = None
    placa_cavalo: Optional[str] = None
    cubagem: Optional[str] = None
    motorista: Optional[str] = None
    empresa_terceirizada: Optional[str] = None
    destino: Optional[str] = None
    hora_saida: Optional[str] = None
    observacao: Optional[str] = None

# ================== AGENDAMENTO MODELS ==================

class AgendamentoCreate(BaseModel):
    tipo: str  # carregamento, visitante, funcionario, diretoria, frota
    data_prevista: str
    hora_prevista: Optional[str] = None
    # Campos para carregamento
    placa_carreta: Optional[str] = None
    placa_cavalo: Optional[str] = None
    cubagem: Optional[str] = None
    motorista: Optional[str] = None
    empresa_terceirizada: Optional[str] = None
    destino: Optional[str] = None
    # Campos gerais
    nome: Optional[str] = None
    placa: Optional[str] = None
    observacao: Optional[str] = None
    # Campos para funcionário - permissão de horário
    setor: Optional[str] = None
    responsavel: Optional[str] = None
    tipo_permissao: Optional[str] = None  # saida_antecipada, entrada_atrasada
    hora_permitida: Optional[str] = None
    # Campos para frota
    carro: Optional[str] = None
    km_saida: Optional[float] = None

class AgendamentoUpdate(BaseModel):
    data_prevista: Optional[str] = None
    hora_prevista: Optional[str] = None
    placa_carreta: Optional[str] = None
    placa_cavalo: Optional[str] = None
    cubagem: Optional[str] = None
    motorista: Optional[str] = None
    empresa_terceirizada: Optional[str] = None
    destino: Optional[str] = None
    nome: Optional[str] = None
    placa: Optional[str] = None
    observacao: Optional[str] = None
    status: Optional[str] = None
    # Campos para funcionário - permissão de horário
    setor: Optional[str] = None
    responsavel: Optional[str] = None
    tipo_permissao: Optional[str] = None
    hora_permitida: Optional[str] = None
    # Campos para frota
    carro: Optional[str] = None
    km_saida: Optional[float] = None

# ================== HELPER: NORMALIZAÇÃO DE DADOS ==================

def normalize_text(text: Optional[str]) -> Optional[str]:
    """Converte texto para MAIÚSCULO"""
    if text:
        return text.upper().strip()
    return text

def normalize_placa(placa: Optional[str]) -> Optional[str]:
    """Converte placa para MAIÚSCULO e remove espaços"""
    if placa:
        return placa.upper().replace(" ", "").strip()
    return placa


def cleanup_photo_list(photos: List[dict]) -> None:
    for photo in photos or []:
        storage_path = photo.get("storage_path")
        if not storage_path:
            continue
        try:
            delete_object(storage_path)
        except Exception as exc:
            logger.warning(f"Failed to cleanup photo {storage_path}: {exc}")

# ================== STARTUP ==================

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting up...")
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@portaria.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hashed,
            "name": "Administrador",
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        })
        logger.info(f"Admin user created: {admin_email}")
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")
    
    # Write test credentials
    memory_dir = BASE_DIR.parent / "memory"
    memory_dir.mkdir(parents=True, exist_ok=True)
    with open(memory_dir / "test_credentials.md", "w", encoding="utf-8") as f:
        f.write("# Test Credentials\n\n")
        f.write(f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n")
        f.write("## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/register\n- POST /api/auth/logout\n- GET /api/auth/me\n- POST /api/auth/refresh\n")
    
    # Init storage
    init_storage()
    
    yield
    
    # Shutdown
    client.close()
    logger.info("Shutdown complete")

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# ================== AUTH ROUTES ==================

@api_router.post("/auth/register")
async def register(data: UserRegister, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": data.role,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    access_token = create_access_token(user_id, email, data.role)
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    
    return {"id": user_id, "email": email, "name": data.name, "role": data.role}

@api_router.post("/auth/login")
async def login(data: UserLogin, request: Request, response: Response):
    email = data.email.lower()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    
    # Check brute force
    attempts = await db.login_attempts.find_one({"identifier": identifier})
    if attempts and attempts.get("count", 0) >= 5:
        lockout_time = attempts.get("last_attempt", datetime.now(timezone.utc))
        if datetime.now(timezone.utc) - lockout_time < timedelta(minutes=15):
            raise HTTPException(status_code=429, detail="Too many attempts. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$inc": {"count": 1}, "$set": {"last_attempt": datetime.now(timezone.utc)}},
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Clear attempts on success
    await db.login_attempts.delete_one({"identifier": identifier})
    
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email, user.get("role", "portaria"))
    refresh_token = create_refresh_token(user_id)
    set_auth_cookies(response, access_token, refresh_token)
    
    return {"id": user_id, "email": email, "name": user.get("name", ""), "role": user.get("role", "portaria")}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    user.pop("password_hash", None)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        user_id = str(user["_id"])
        access_token = create_access_token(user_id, user["email"], user.get("role", "portaria"))
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            max_age=ACCESS_TOKEN_MAX_AGE,
            path="/",
        )
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

# ================== USER MANAGEMENT ==================

@api_router.get("/users")
async def list_users(request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    users = await db.users.find({}, {"password_hash": 0}).to_list(1000)
    return [serialize_doc(u) for u in users]

@api_router.post("/users")
async def create_user(data: UserRegister, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    hashed = hash_password(data.password)
    user_doc = {
        "email": email,
        "password_hash": hashed,
        "name": data.name,
        "role": data.role,
        "created_at": datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(user_doc)
    return {"id": str(result.inserted_id), "email": email, "name": data.name, "role": data.role}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, data: UserUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    
    update_data = {}
    if data.name:
        update_data["name"] = data.name
    if data.email:
        update_data["email"] = data.email.lower()
    if data.role:
        update_data["role"] = data.role
    if data.password:
        update_data["password_hash"] = hash_password(data.password)
    
    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    
    updated = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    return serialize_doc(updated)

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "User deleted"}

# ================== VISITORS ==================

@api_router.post("/visitors")
async def create_visitor(data: VisitorCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "nome": normalize_text(data.nome),
        "placa": normalize_placa(data.placa),
        "veiculo": normalize_text(data.veiculo),
        "observacao": data.observacao,
        "data": now.strftime("%Y-%m-%d"),
        "hora_entrada": now.strftime("%H:%M"),
        "hora_saida": None,
        "porteiro": user.get("name", ""),
        "porteiro_id": user.get("id", ""),
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.visitors.insert_one(doc)
    
    # Log history
    await db.history.insert_one({
        "collection": "visitors",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": doc
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.get("/visitors")
async def list_visitors(
    request: Request,
    nome: Optional[str] = None,
    placa: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if data_inicio and data_fim:
        query["data"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data"] = {"$gte": data_inicio}
    elif data_fim:
        query["data"] = {"$lte": data_fim}
    
    visitors = await db.visitors.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.visitors.count_documents(query)
    
    return {"items": [serialize_doc(v) for v in visitors], "total": total}

@api_router.get("/visitors/{visitor_id}")
async def get_visitor(visitor_id: str, request: Request):
    await get_current_user(request)
    visitor = await db.visitors.find_one({"_id": ObjectId(visitor_id)})
    if not visitor:
        raise HTTPException(status_code=404, detail="Visitor not found")
    return serialize_doc(visitor)

@api_router.put("/visitors/{visitor_id}")
async def update_visitor(visitor_id: str, data: VisitorUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.placa is not None:
        update_data["placa"] = data.placa
    if data.veiculo is not None:
        update_data["veiculo"] = data.veiculo
    if data.observacao is not None:
        update_data["observacao"] = data.observacao
    if data.hora_saida is not None:
        update_data["hora_saida"] = data.hora_saida
    
    await db.visitors.update_one({"_id": ObjectId(visitor_id)}, {"$set": update_data})
    
    # Log history
    await db.history.insert_one({
        "collection": "visitors",
        "document_id": visitor_id,
        "action": "update",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc),
        "changes": update_data
    })
    
    updated = await db.visitors.find_one({"_id": ObjectId(visitor_id)})
    return serialize_doc(updated)

@api_router.delete("/visitors/{visitor_id}")
async def delete_visitor(visitor_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    await db.visitors.delete_one({"_id": ObjectId(visitor_id)})
    return {"message": "Visitor deleted"}

# ================== FLEET ==================

@api_router.post("/fleet")
async def create_fleet(data: FleetCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "carro": data.carro,
        "placa": data.placa.upper(),
        "motorista": data.motorista,
        "destino": data.destino,
        "km_saida": data.km_saida,
        "km_retorno": None,
        "km_rodado": None,
        "data_saida": now.strftime("%Y-%m-%d"),
        "hora_saida": now.strftime("%H:%M"),
        "data_retorno": None,
        "hora_retorno": None,
        "porteiro_saida": user.get("name", ""),
        "porteiro_saida_id": user.get("id", ""),
        "porteiro_retorno": None,
        "porteiro_retorno_id": None,
        "observacao": data.observacao,
        "status": "em_uso",
        "fotos_saida": [],
        "fotos_retorno": [],
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.fleet.insert_one(doc)
    
    await db.history.insert_one({
        "collection": "fleet",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": {"action": "saida", **data.model_dump()}
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.post("/fleet/{fleet_id}/return")
async def return_fleet(fleet_id: str, data: FleetReturn, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    fleet = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet record not found")
    
    now = get_brazil_now()
    km_rodado = data.km_retorno - fleet.get("km_saida", 0)
    
    update_data = {
        "km_retorno": data.km_retorno,
        "km_rodado": km_rodado,
        "data_retorno": now.strftime("%Y-%m-%d"),
        "hora_retorno": now.strftime("%H:%M"),
        "porteiro_retorno": user.get("name", ""),
        "porteiro_retorno_id": user.get("id", ""),
        "status": "retornado",
        "updated_at": now
    }
    if data.observacao:
        update_data["observacao_retorno"] = data.observacao
    
    await db.fleet.update_one({"_id": ObjectId(fleet_id)}, {"$set": update_data})
    
    await db.history.insert_one({
        "collection": "fleet",
        "document_id": fleet_id,
        "action": "return",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": update_data
    })
    
    updated = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    return serialize_doc(updated)

@api_router.get("/fleet")
async def list_fleet(
    request: Request,
    placa: Optional[str] = None,
    motorista: Optional[str] = None,
    destino: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if motorista:
        query["motorista"] = {"$regex": motorista, "$options": "i"}
    if destino:
        query["destino"] = {"$regex": destino, "$options": "i"}
    if status:
        query["status"] = status
    if data_inicio and data_fim:
        query["data_saida"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data_saida"] = {"$gte": data_inicio}
    elif data_fim:
        query["data_saida"] = {"$lte": data_fim}
    
    fleet = await db.fleet.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.fleet.count_documents(query)
    
    return {"items": [serialize_doc(f) for f in fleet], "total": total}

@api_router.get("/fleet/{fleet_id}")
async def get_fleet(fleet_id: str, request: Request):
    await get_current_user(request)
    fleet = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet record not found")
    return serialize_doc(fleet)

@api_router.delete("/fleet/{fleet_id}")
async def delete_fleet(fleet_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    fleet = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    if fleet:
        cleanup_photo_list(fleet.get("fotos_saida", []))
        cleanup_photo_list(fleet.get("fotos_retorno", []))
    await db.fleet.delete_one({"_id": ObjectId(fleet_id)})
    return {"message": "Fleet record deleted"}

# ================== FLEET PHOTOS ==================

@api_router.post("/fleet/{fleet_id}/photos")
async def upload_fleet_photo(
    fleet_id: str,
    request: Request,
    file: UploadFile = File(...),
    category: str = Query(..., description="placa, motorista, interior, frente, traseira, lateral, avaria"),
    moment: str = Query(..., description="saida or retorno")
):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    fleet = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet record not found")
    
    # Upload to storage
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    path = f"{APP_NAME}/fleet/{fleet_id}/{moment}/{category}_{uuid.uuid4()}.{ext}"
    data = await file.read()
    
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo")
    
    photo_doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "storage_backend": result.get("storage_backend", STORAGE_BACKEND),
        "original_filename": file.filename,
        "content_type": file.content_type,
        "category": category,
        "moment": moment,
        "uploaded_by": user.get("name"),
        "uploaded_by_id": user.get("id"),
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    field = "fotos_saida" if moment == "saida" else "fotos_retorno"
    await db.fleet.update_one(
        {"_id": ObjectId(fleet_id)},
        {"$push": {field: photo_doc}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    return photo_doc

@api_router.get("/fleet/{fleet_id}/photos/{photo_id}")
async def get_fleet_photo(fleet_id: str, photo_id: str, request: Request):
    try:
        await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    fleet = await db.fleet.find_one({"_id": ObjectId(fleet_id)})
    if not fleet:
        raise HTTPException(status_code=404, detail="Fleet record not found")
    
    # Find photo in both arrays
    photo = None
    for p in fleet.get("fotos_saida", []) + fleet.get("fotos_retorno", []):
        if p.get("id") == photo_id:
            photo = p
            break
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        data, content_type = get_object(photo["storage_path"])
        return Response(content=data, media_type=photo.get("content_type", content_type))
    except Exception as e:
        logger.error(f"Failed to get photo: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve photo")

# ================== EMPLOYEES ==================

@api_router.post("/employees")
async def create_employee(data: EmployeeCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "nome": normalize_text(data.nome),
        "setor": normalize_text(data.setor),
        "responsavel": normalize_text(data.responsavel),
        "autorizado": data.autorizado,
        "placa": normalize_placa(data.placa),
        "observacao": data.observacao,
        "data": now.strftime("%Y-%m-%d"),
        "hora_entrada": now.strftime("%H:%M"),
        "hora_saida": None,
        "porteiro": user.get("name", ""),
        "porteiro_id": user.get("id", ""),
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.employees.insert_one(doc)
    
    await db.history.insert_one({
        "collection": "employees",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": doc
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.get("/employees")
async def list_employees(
    request: Request,
    nome: Optional[str] = None,
    setor: Optional[str] = None,
    placa: Optional[str] = None,
    autorizado: Optional[bool] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if setor:
        query["setor"] = {"$regex": setor, "$options": "i"}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if autorizado is not None:
        query["autorizado"] = autorizado
    if data_inicio and data_fim:
        query["data"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data"] = {"$gte": data_inicio}
    elif data_fim:
        query["data"] = {"$lte": data_fim}
    
    employees = await db.employees.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.employees.count_documents(query)
    
    return {"items": [serialize_doc(e) for e in employees], "total": total}

@api_router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, request: Request):
    await get_current_user(request)
    employee = await db.employees.find_one({"_id": ObjectId(employee_id)})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return serialize_doc(employee)

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, data: EmployeeUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.setor is not None:
        update_data["setor"] = data.setor
    if data.responsavel is not None:
        update_data["responsavel"] = data.responsavel
    if data.autorizado is not None:
        update_data["autorizado"] = data.autorizado
    if data.placa is not None:
        update_data["placa"] = data.placa
    if data.hora_saida is not None:
        update_data["hora_saida"] = data.hora_saida
    if data.observacao is not None:
        update_data["observacao"] = data.observacao
    
    await db.employees.update_one({"_id": ObjectId(employee_id)}, {"$set": update_data})
    
    await db.history.insert_one({
        "collection": "employees",
        "document_id": employee_id,
        "action": "update",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc),
        "changes": update_data
    })
    
    updated = await db.employees.find_one({"_id": ObjectId(employee_id)})
    return serialize_doc(updated)

@api_router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    await db.employees.delete_one({"_id": ObjectId(employee_id)})
    return {"message": "Employee deleted"}

# ================== DIRECTORS ==================

@api_router.post("/directors")
async def create_director(data: DirectorCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "nome": normalize_text(data.nome),
        "placa": normalize_placa(data.placa),
        "carro": normalize_text(data.carro),
        "observacao": data.observacao,
        "data": now.strftime("%Y-%m-%d"),
        "hora_entrada": now.strftime("%H:%M"),
        "hora_saida_almoco": None,
        "hora_retorno_almoco": None,
        "hora_saida": None,
        "status": "presente",
        "porteiro": user.get("name", ""),
        "porteiro_id": user.get("id", ""),
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.directors.insert_one(doc)
    
    await db.history.insert_one({
        "collection": "directors",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": doc
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.get("/directors")
async def list_directors(
    request: Request,
    nome: Optional[str] = None,
    placa: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if data_inicio and data_fim:
        query["data"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data"] = {"$gte": data_inicio}
    elif data_fim:
        query["data"] = {"$lte": data_fim}
    
    directors = await db.directors.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.directors.count_documents(query)
    
    return {"items": [serialize_doc(d) for d in directors], "total": total}

@api_router.get("/directors/{director_id}")
async def get_director(director_id: str, request: Request):
    await get_current_user(request)
    director = await db.directors.find_one({"_id": ObjectId(director_id)})
    if not director:
        raise HTTPException(status_code=404, detail="Director not found")
    return serialize_doc(director)

@api_router.put("/directors/{director_id}")
async def update_director(director_id: str, data: DirectorUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.placa is not None:
        update_data["placa"] = data.placa
    if data.carro is not None:
        update_data["carro"] = data.carro
    if data.hora_saida_almoco is not None:
        update_data["hora_saida_almoco"] = data.hora_saida_almoco
        update_data["status"] = "almoco"
    if data.hora_retorno_almoco is not None:
        update_data["hora_retorno_almoco"] = data.hora_retorno_almoco
        update_data["status"] = "presente"
    if data.hora_saida is not None:
        update_data["hora_saida"] = data.hora_saida
        update_data["status"] = "saiu"
    if data.observacao is not None:
        update_data["observacao"] = data.observacao
    
    await db.directors.update_one({"_id": ObjectId(director_id)}, {"$set": update_data})
    
    await db.history.insert_one({
        "collection": "directors",
        "document_id": director_id,
        "action": "update",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc),
        "changes": update_data
    })
    
    updated = await db.directors.find_one({"_id": ObjectId(director_id)})
    return serialize_doc(updated)

@api_router.delete("/directors/{director_id}")
async def delete_director(director_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    await db.directors.delete_one({"_id": ObjectId(director_id)})
    return {"message": "Director deleted"}

# ================== DASHBOARD ==================

@api_router.get("/dashboard")
async def get_dashboard(request: Request):
    await get_current_user(request)
    
    today = get_brazil_today()
    
    # Today stats
    visitors_today = await db.visitors.count_documents({"data": today})
    employees_today = await db.employees.count_documents({"data": today})
    directors_today = await db.directors.count_documents({"data": today})
    fleet_in_use = await db.fleet.count_documents({"status": "em_uso"})
    fleet_returned_today = await db.fleet.count_documents({"data_retorno": today, "status": "retornado"})
    carregamentos_hoje = await db.carregamentos.count_documents({"data": today})
    carregamentos_em_andamento = await db.carregamentos.count_documents({"status": "em_carregamento"})
    agendamentos_hoje = await db.agendamentos.count_documents({"data_prevista": today, "status": "pendente"})
    
    # Week stats
    week_start = (get_brazil_now() - timedelta(days=7)).strftime("%Y-%m-%d")
    visitors_week = await db.visitors.count_documents({"data": {"$gte": week_start}})
    employees_week = await db.employees.count_documents({"data": {"$gte": week_start}})
    
    # Recent activity
    recent_visitors = await db.visitors.find({}).sort("created_at", -1).limit(5).to_list(5)
    recent_fleet = await db.fleet.find({}).sort("created_at", -1).limit(5).to_list(5)
    
    # Fleet in use
    fleet_out = await db.fleet.find({"status": "em_uso"}).sort("created_at", -1).to_list(100)
    
    # Agendamentos do dia
    agendamentos_dia = await db.agendamentos.find({
        "data_prevista": today,
        "status": "pendente"
    }).sort("hora_prevista", 1).to_list(10)
    
    return {
        "today": {
            "visitors": visitors_today,
            "employees": employees_today,
            "directors": directors_today,
            "fleet_in_use": fleet_in_use,
            "fleet_returned": fleet_returned_today,
            "carregamentos": carregamentos_hoje,
            "carregamentos_em_andamento": carregamentos_em_andamento,
            "agendamentos": agendamentos_hoje
        },
        "week": {
            "visitors": visitors_week,
            "employees": employees_week
        },
        "recent_visitors": [serialize_doc(v) for v in recent_visitors],
        "recent_fleet": [serialize_doc(f) for f in recent_fleet],
        "fleet_out": [serialize_doc(f) for f in fleet_out],
        "agendamentos_dia": [serialize_doc(a) for a in agendamentos_dia]
    }

# ================== HISTORY ==================

@api_router.get("/history")
async def get_history(
    request: Request,
    collection: Optional[str] = None,
    document_id: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    user = await get_current_user(request)
    await check_role(user, ["admin", "gestor", "diretoria"])
    
    query = {}
    if collection:
        query["collection"] = collection
    if document_id:
        query["document_id"] = document_id
    
    history = await db.history.find(query).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.history.count_documents(query)
    
    return {"items": [serialize_doc(h) for h in history], "total": total}

# ================== REPORTS ==================

@api_router.get("/reports/visitors")
async def report_visitors(
    request: Request,
    data_inicio: str,
    data_fim: str,
    nome: Optional[str] = None,
    placa: Optional[str] = None,
    porteiro: Optional[str] = None
):
    await get_current_user(request)
    
    query = {"data": {"$gte": data_inicio, "$lte": data_fim}}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if porteiro:
        query["porteiro"] = {"$regex": porteiro, "$options": "i"}
    
    visitors = await db.visitors.find(query).sort("created_at", -1).to_list(10000)
    return {"items": [serialize_doc(v) for v in visitors], "total": len(visitors)}

@api_router.get("/reports/fleet")
async def report_fleet(
    request: Request,
    data_inicio: str,
    data_fim: str,
    placa: Optional[str] = None,
    motorista: Optional[str] = None,
    destino: Optional[str] = None,
    porteiro: Optional[str] = None
):
    await get_current_user(request)
    
    query = {"data_saida": {"$gte": data_inicio, "$lte": data_fim}}
    if placa:
        query["placa"] = {"$regex": placa, "$options": "i"}
    if motorista:
        query["motorista"] = {"$regex": motorista, "$options": "i"}
    if destino:
        query["destino"] = {"$regex": destino, "$options": "i"}
    if porteiro:
        query["$or"] = [
            {"porteiro_saida": {"$regex": porteiro, "$options": "i"}},
            {"porteiro_retorno": {"$regex": porteiro, "$options": "i"}}
        ]
    
    fleet = await db.fleet.find(query).sort("created_at", -1).to_list(10000)
    
    # Calculate totals
    total_km = sum(f.get("km_rodado", 0) or 0 for f in fleet)
    
    return {
        "items": [serialize_doc(f) for f in fleet],
        "total": len(fleet),
        "total_km": total_km
    }

@api_router.get("/reports/employees")
async def report_employees(
    request: Request,
    data_inicio: str,
    data_fim: str,
    nome: Optional[str] = None,
    setor: Optional[str] = None,
    autorizado: Optional[bool] = None,
    porteiro: Optional[str] = None
):
    await get_current_user(request)
    
    query = {"data": {"$gte": data_inicio, "$lte": data_fim}}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if setor:
        query["setor"] = {"$regex": setor, "$options": "i"}
    if autorizado is not None:
        query["autorizado"] = autorizado
    if porteiro:
        query["porteiro"] = {"$regex": porteiro, "$options": "i"}
    
    employees = await db.employees.find(query).sort("created_at", -1).to_list(10000)
    return {"items": [serialize_doc(e) for e in employees], "total": len(employees)}

@api_router.get("/reports/directors")
async def report_directors(
    request: Request,
    data_inicio: str,
    data_fim: str,
    nome: Optional[str] = None,
    porteiro: Optional[str] = None
):
    await get_current_user(request)
    
    query = {"data": {"$gte": data_inicio, "$lte": data_fim}}
    if nome:
        query["nome"] = {"$regex": nome, "$options": "i"}
    if porteiro:
        query["porteiro"] = {"$regex": porteiro, "$options": "i"}
    
    directors = await db.directors.find(query).sort("created_at", -1).to_list(10000)
    return {"items": [serialize_doc(d) for d in directors], "total": len(directors)}

# ================== CARREGAMENTO ==================

@api_router.post("/carregamentos")
async def create_carregamento(data: CarregamentoCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "placa_carreta": data.placa_carreta.upper(),
        "placa_cavalo": data.placa_cavalo.upper(),
        "cubagem": data.cubagem,
        "motorista": data.motorista,
        "empresa_terceirizada": data.empresa_terceirizada,
        "destino": data.destino,
        "observacao": data.observacao,
        "data": now.strftime("%Y-%m-%d"),
        "hora_entrada": now.strftime("%H:%M"),
        "hora_saida": None,
        "status": "em_carregamento",
        "agendamento_id": data.agendamento_id,
        "porteiro_entrada": user.get("name", ""),
        "porteiro_entrada_id": user.get("id", ""),
        "porteiro_saida": None,
        "porteiro_saida_id": None,
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.carregamentos.insert_one(doc)
    
    # Update agendamento status if linked
    if data.agendamento_id:
        await db.agendamentos.update_one(
            {"_id": ObjectId(data.agendamento_id)},
            {"$set": {"status": "realizado", "updated_at": now}}
        )
    
    await db.history.insert_one({
        "collection": "carregamentos",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": doc
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.get("/carregamentos")
async def list_carregamentos(
    request: Request,
    placa_carreta: Optional[str] = None,
    placa_cavalo: Optional[str] = None,
    motorista: Optional[str] = None,
    empresa: Optional[str] = None,
    destino: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if placa_carreta:
        query["placa_carreta"] = {"$regex": placa_carreta, "$options": "i"}
    if placa_cavalo:
        query["placa_cavalo"] = {"$regex": placa_cavalo, "$options": "i"}
    if motorista:
        query["motorista"] = {"$regex": motorista, "$options": "i"}
    if empresa:
        query["empresa_terceirizada"] = {"$regex": empresa, "$options": "i"}
    if destino:
        query["destino"] = {"$regex": destino, "$options": "i"}
    if status:
        query["status"] = status
    if data_inicio and data_fim:
        query["data"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data"] = {"$gte": data_inicio}
    elif data_fim:
        query["data"] = {"$lte": data_fim}
    
    carregamentos = await db.carregamentos.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.carregamentos.count_documents(query)
    
    return {"items": [serialize_doc(c) for c in carregamentos], "total": total}

@api_router.get("/carregamentos/{carregamento_id}")
async def get_carregamento(carregamento_id: str, request: Request):
    await get_current_user(request)
    carregamento = await db.carregamentos.find_one({"_id": ObjectId(carregamento_id)})
    if not carregamento:
        raise HTTPException(status_code=404, detail="Carregamento not found")
    return serialize_doc(carregamento)

@api_router.put("/carregamentos/{carregamento_id}")
async def update_carregamento(carregamento_id: str, data: CarregamentoUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.placa_carreta is not None:
        update_data["placa_carreta"] = data.placa_carreta.upper()
    if data.placa_cavalo is not None:
        update_data["placa_cavalo"] = data.placa_cavalo.upper()
    if data.cubagem is not None:
        update_data["cubagem"] = data.cubagem
    if data.motorista is not None:
        update_data["motorista"] = data.motorista
    if data.empresa_terceirizada is not None:
        update_data["empresa_terceirizada"] = data.empresa_terceirizada
    if data.destino is not None:
        update_data["destino"] = data.destino
    if data.hora_saida is not None:
        update_data["hora_saida"] = data.hora_saida
        update_data["status"] = "finalizado"
        update_data["porteiro_saida"] = user.get("name", "")
        update_data["porteiro_saida_id"] = user.get("id", "")
    if data.observacao is not None:
        update_data["observacao"] = data.observacao
    
    await db.carregamentos.update_one({"_id": ObjectId(carregamento_id)}, {"$set": update_data})
    
    await db.history.insert_one({
        "collection": "carregamentos",
        "document_id": carregamento_id,
        "action": "update",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc),
        "changes": update_data
    })
    
    updated = await db.carregamentos.find_one({"_id": ObjectId(carregamento_id)})
    return serialize_doc(updated)

@api_router.delete("/carregamentos/{carregamento_id}")
async def delete_carregamento(carregamento_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin"])
    carregamento = await db.carregamentos.find_one({"_id": ObjectId(carregamento_id)})
    if carregamento:
        cleanup_photo_list(carregamento.get("fotos", []))
    await db.carregamentos.delete_one({"_id": ObjectId(carregamento_id)})
    return {"message": "Carregamento deleted"}

# ================== AGENDAMENTOS ==================

@api_router.post("/agendamentos")
async def create_agendamento(data: AgendamentoCreate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "gestor", "dsl", "portaria"])
    
    now = get_brazil_now()
    doc = {
        "tipo": data.tipo,
        "data_prevista": data.data_prevista,
        "hora_prevista": data.hora_prevista,
        "placa_carreta": normalize_placa(data.placa_carreta),
        "placa_cavalo": normalize_placa(data.placa_cavalo),
        "cubagem": data.cubagem,
        "motorista": normalize_text(data.motorista),
        "empresa_terceirizada": normalize_text(data.empresa_terceirizada),
        "destino": normalize_text(data.destino),
        "nome": normalize_text(data.nome),
        "placa": normalize_placa(data.placa),
        "observacao": data.observacao,
        "status": "pendente",
        # Campos para funcionário - permissão de horário
        "setor": normalize_text(data.setor),
        "responsavel": normalize_text(data.responsavel),
        "tipo_permissao": data.tipo_permissao,
        "hora_permitida": data.hora_permitida,
        # Campos para frota
        "carro": normalize_text(data.carro),
        "km_saida": data.km_saida,
        "criado_por": user.get("name", ""),
        "criado_por_id": user.get("id", ""),
        "created_at": now,
        "updated_at": now
    }
    
    result = await db.agendamentos.insert_one(doc)
    
    await db.history.insert_one({
        "collection": "agendamentos",
        "document_id": str(result.inserted_id),
        "action": "create",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": doc
    })
    
    return serialize_doc({**doc, "_id": result.inserted_id})

@api_router.get("/agendamentos")
async def list_agendamentos(
    request: Request,
    tipo: Optional[str] = None,
    status: Optional[str] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    motorista: Optional[str] = None,
    empresa: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    await get_current_user(request)
    
    query = {}
    if tipo:
        query["tipo"] = tipo
    if status:
        query["status"] = status
    if motorista:
        query["motorista"] = {"$regex": motorista, "$options": "i"}
    if empresa:
        query["empresa_terceirizada"] = {"$regex": empresa, "$options": "i"}
    if data_inicio and data_fim:
        query["data_prevista"] = {"$gte": data_inicio, "$lte": data_fim}
    elif data_inicio:
        query["data_prevista"] = {"$gte": data_inicio}
    elif data_fim:
        query["data_prevista"] = {"$lte": data_fim}
    
    agendamentos = await db.agendamentos.find(query).sort("data_prevista", 1).skip(skip).limit(limit).to_list(limit)
    total = await db.agendamentos.count_documents(query)
    
    return {"items": [serialize_doc(a) for a in agendamentos], "total": total}

@api_router.get("/agendamentos/hoje")
async def list_agendamentos_hoje(request: Request):
    await get_current_user(request)
    today = get_brazil_today()
    
    agendamentos = await db.agendamentos.find({
        "data_prevista": today,
        "status": "pendente"
    }).sort("hora_prevista", 1).to_list(100)
    
    return {"items": [serialize_doc(a) for a in agendamentos], "total": len(agendamentos)}

@api_router.get("/agendamentos/{agendamento_id}")
async def get_agendamento(agendamento_id: str, request: Request):
    await get_current_user(request)
    agendamento = await db.agendamentos.find_one({"_id": ObjectId(agendamento_id)})
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento not found")
    return serialize_doc(agendamento)

@api_router.put("/agendamentos/{agendamento_id}")
async def update_agendamento(agendamento_id: str, data: AgendamentoUpdate, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "gestor", "dsl"])
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    if data.data_prevista is not None:
        update_data["data_prevista"] = data.data_prevista
    if data.hora_prevista is not None:
        update_data["hora_prevista"] = data.hora_prevista
    if data.placa_carreta is not None:
        update_data["placa_carreta"] = data.placa_carreta.upper()
    if data.placa_cavalo is not None:
        update_data["placa_cavalo"] = data.placa_cavalo.upper()
    if data.cubagem is not None:
        update_data["cubagem"] = data.cubagem
    if data.motorista is not None:
        update_data["motorista"] = data.motorista
    if data.empresa_terceirizada is not None:
        update_data["empresa_terceirizada"] = data.empresa_terceirizada
    if data.destino is not None:
        update_data["destino"] = data.destino
    if data.nome is not None:
        update_data["nome"] = data.nome
    if data.placa is not None:
        update_data["placa"] = data.placa.upper()
    if data.observacao is not None:
        update_data["observacao"] = data.observacao
    if data.status is not None:
        update_data["status"] = data.status
    
    await db.agendamentos.update_one({"_id": ObjectId(agendamento_id)}, {"$set": update_data})
    
    await db.history.insert_one({
        "collection": "agendamentos",
        "document_id": agendamento_id,
        "action": "update",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": datetime.now(timezone.utc),
        "changes": update_data
    })
    
    updated = await db.agendamentos.find_one({"_id": ObjectId(agendamento_id)})
    return serialize_doc(updated)

@api_router.delete("/agendamentos/{agendamento_id}")
async def delete_agendamento(agendamento_id: str, request: Request):
    user = await get_current_user(request)
    await check_role(user, ["admin", "gestor", "dsl"])
    await db.agendamentos.delete_one({"_id": ObjectId(agendamento_id)})
    return {"message": "Agendamento deleted"}

# ================== DAR ENTRADA (Converter agendamento em registro ativo) ==================

@api_router.post("/agendamentos/{agendamento_id}/dar-entrada")
async def dar_entrada_agendamento(agendamento_id: str, request: Request):
    """Converte um agendamento em registro ativo no módulo correspondente"""
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    agendamento = await db.agendamentos.find_one({"_id": ObjectId(agendamento_id)})
    if not agendamento:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    if agendamento.get("status") != "pendente":
        raise HTTPException(status_code=400, detail="Agendamento já foi processado")
    
    now = get_brazil_now()
    tipo = agendamento.get("tipo")
    result = None
    
    if tipo == "carregamento":
        doc = {
            "placa_carreta": agendamento.get("placa_carreta"),
            "placa_cavalo": agendamento.get("placa_cavalo"),
            "cubagem": agendamento.get("cubagem"),
            "motorista": agendamento.get("motorista"),
            "empresa_terceirizada": agendamento.get("empresa_terceirizada"),
            "destino": agendamento.get("destino"),
            "observacao": agendamento.get("observacao"),
            "data": now.strftime("%Y-%m-%d"),
            "hora_entrada": now.strftime("%H:%M"),
            "hora_saida": None,
            "status": "em_carregamento",
            "agendamento_id": agendamento_id,
            "porteiro_entrada": user.get("name", ""),
            "porteiro_entrada_id": user.get("id", ""),
            "porteiro_saida": None,
            "porteiro_saida_id": None,
            "fotos": [],
            "created_at": now,
            "updated_at": now
        }
        result = await db.carregamentos.insert_one(doc)
        
    elif tipo == "visitante":
        doc = {
            "nome": agendamento.get("nome"),
            "placa": agendamento.get("placa"),
            "veiculo": agendamento.get("veiculo"),
            "observacao": agendamento.get("observacao"),
            "data": now.strftime("%Y-%m-%d"),
            "hora_entrada": now.strftime("%H:%M"),
            "hora_saida": None,
            "agendamento_id": agendamento_id,
            "porteiro": user.get("name", ""),
            "porteiro_id": user.get("id", ""),
            "created_at": now,
            "updated_at": now
        }
        result = await db.visitors.insert_one(doc)
        
    elif tipo == "funcionario":
        doc = {
            "nome": agendamento.get("nome"),
            "setor": agendamento.get("setor"),
            "responsavel": agendamento.get("responsavel"),
            "autorizado": True,
            "placa": agendamento.get("placa"),
            "observacao": agendamento.get("observacao"),
            "tipo_permissao": agendamento.get("tipo_permissao"),
            "hora_permitida": agendamento.get("hora_permitida"),
            "data": now.strftime("%Y-%m-%d"),
            "hora_entrada": now.strftime("%H:%M"),
            "hora_saida": None,
            "agendamento_id": agendamento_id,
            "porteiro": user.get("name", ""),
            "porteiro_id": user.get("id", ""),
            "created_at": now,
            "updated_at": now
        }
        result = await db.employees.insert_one(doc)
        
    elif tipo == "diretoria":
        doc = {
            "nome": agendamento.get("nome"),
            "placa": agendamento.get("placa"),
            "carro": agendamento.get("carro"),
            "observacao": agendamento.get("observacao"),
            "data": now.strftime("%Y-%m-%d"),
            "hora_entrada": now.strftime("%H:%M"),
            "hora_saida_almoco": None,
            "hora_retorno_almoco": None,
            "hora_saida": None,
            "status": "presente",
            "agendamento_id": agendamento_id,
            "porteiro": user.get("name", ""),
            "porteiro_id": user.get("id", ""),
            "created_at": now,
            "updated_at": now
        }
        result = await db.directors.insert_one(doc)
        
    elif tipo == "frota":
        doc = {
            "carro": agendamento.get("carro"),
            "placa": agendamento.get("placa"),
            "motorista": agendamento.get("motorista"),
            "destino": agendamento.get("destino"),
            "km_saida": agendamento.get("km_saida") or 0,
            "km_retorno": None,
            "km_rodado": None,
            "data_saida": now.strftime("%Y-%m-%d"),
            "hora_saida": now.strftime("%H:%M"),
            "data_retorno": None,
            "hora_retorno": None,
            "porteiro_saida": user.get("name", ""),
            "porteiro_saida_id": user.get("id", ""),
            "porteiro_retorno": None,
            "porteiro_retorno_id": None,
            "observacao": agendamento.get("observacao"),
            "status": "em_uso",
            "agendamento_id": agendamento_id,
            "fotos_saida": [],
            "fotos_retorno": [],
            "created_at": now,
            "updated_at": now
        }
        result = await db.fleet.insert_one(doc)
    else:
        raise HTTPException(status_code=400, detail=f"Tipo de agendamento inválido: {tipo}")
    
    # Atualizar status do agendamento
    await db.agendamentos.update_one(
        {"_id": ObjectId(agendamento_id)},
        {"$set": {"status": "em_andamento", "updated_at": now}}
    )
    
    # Log history
    await db.history.insert_one({
        "collection": "agendamentos",
        "document_id": agendamento_id,
        "action": "dar_entrada",
        "user_id": user.get("id"),
        "user_name": user.get("name"),
        "timestamp": now,
        "changes": {"status": "em_andamento", "registro_id": str(result.inserted_id)}
    })
    
    return {
        "message": "Entrada registrada com sucesso",
        "tipo": tipo,
        "registro_id": str(result.inserted_id)
    }

# ================== CARREGAMENTO PHOTOS ==================

@api_router.post("/carregamentos/{carregamento_id}/photos")
async def upload_carregamento_photo(
    carregamento_id: str,
    request: Request,
    file: UploadFile = File(...),
    categoria: str = Query("geral", description="Categoria da foto: geral, placa, motorista, carga")
):
    user = await get_current_user(request)
    await check_role(user, ["admin", "portaria"])
    
    carregamento = await db.carregamentos.find_one({"_id": ObjectId(carregamento_id)})
    if not carregamento:
        raise HTTPException(status_code=404, detail="Carregamento não encontrado")
    
    # Upload to storage
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    path = f"{APP_NAME}/carregamentos/{carregamento_id}/{categoria}_{uuid.uuid4()}.{ext}"
    data = await file.read()
    
    try:
        result = put_object(path, data, file.content_type or "image/jpeg")
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail="Falha ao enviar foto")
    
    photo_doc = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "storage_backend": result.get("storage_backend", STORAGE_BACKEND),
        "original_filename": file.filename,
        "content_type": file.content_type,
        "categoria": categoria,
        "uploaded_by": user.get("name"),
        "uploaded_by_id": user.get("id"),
        "uploaded_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.carregamentos.update_one(
        {"_id": ObjectId(carregamento_id)},
        {"$push": {"fotos": photo_doc}, "$set": {"updated_at": datetime.now(timezone.utc)}}
    )
    
    return photo_doc

@api_router.get("/carregamentos/{carregamento_id}/photos/{photo_id}")
async def get_carregamento_photo(carregamento_id: str, photo_id: str, request: Request):
    try:
        await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    carregamento = await db.carregamentos.find_one({"_id": ObjectId(carregamento_id)})
    if not carregamento:
        raise HTTPException(status_code=404, detail="Carregamento não encontrado")
    
    photo = None
    for p in carregamento.get("fotos", []):
        if p.get("id") == photo_id:
            photo = p
            break
    
    if not photo:
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    
    try:
        data, content_type = get_object(photo["storage_path"])
        return Response(content=data, media_type=photo.get("content_type", content_type))
    except Exception as e:
        logger.error(f"Falha ao obter foto: {e}")
        raise HTTPException(status_code=500, detail="Falha ao obter foto")

@api_router.get("/reports/carregamentos")
async def report_carregamentos(
    request: Request,
    data_inicio: str,
    data_fim: str,
    motorista: Optional[str] = None,
    empresa: Optional[str] = None,
    destino: Optional[str] = None,
    porteiro: Optional[str] = None
):
    await get_current_user(request)
    
    query = {"data": {"$gte": data_inicio, "$lte": data_fim}}
    if motorista:
        query["motorista"] = {"$regex": motorista, "$options": "i"}
    if empresa:
        query["empresa_terceirizada"] = {"$regex": empresa, "$options": "i"}
    if destino:
        query["destino"] = {"$regex": destino, "$options": "i"}
    if porteiro:
        query["$or"] = [
            {"porteiro_entrada": {"$regex": porteiro, "$options": "i"}},
            {"porteiro_saida": {"$regex": porteiro, "$options": "i"}}
        ]
    
    carregamentos = await db.carregamentos.find(query).sort("created_at", -1).to_list(10000)
    return {"items": [serialize_doc(c) for c in carregamentos], "total": len(carregamentos)}

# ================== ROOT ==================

@api_router.get("/")
async def root():
    return {"message": "Portaria Access Control API", "version": "1.0.0"}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        "https://cipo-manager.preview.emergentagent.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
