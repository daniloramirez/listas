import os
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import HTTPException, Request, Response, Depends
from sqlalchemy.orm import Session
from db import get_db
from modelos import Usuario
import hashlib

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _bcrypt_input(password: str) -> str:
    b = password.encode("utf-8")
    if len(b) > 72:
        # Pre-hash estable (no truncar)
        return hashlib.sha256(b).hexdigest()  # 64 chars ascii
    return password

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME")
JWT_EXP_MIN = int(os.getenv("JWT_EXP_MIN", "43200"))  # 30 días
COOKIE_NAME = os.getenv("COOKIE_NAME", "listas_token")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "0") == "1"  # prod=1
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")   # lax funciona bien
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN")              # opcional (deja vacío en dev)

def hash_password(p: str) -> str:
    return pwd.hash(_bcrypt_input(p))

def verify_password(p: str, hashed: str) -> bool:
    return pwd.verify(_bcrypt_input(p), hashed)

def crear_token(usuario_id) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=JWT_EXP_MIN)
    payload = {"sub": str(usuario_id), "iat": int(now.timestamp()), "exp": int(exp.timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def set_cookie(resp: Response, token: str):
    resp.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
        max_age=JWT_EXP_MIN * 60,
    )

def clear_cookie(resp: Response):
    resp.delete_cookie(key=COOKIE_NAME, domain=COOKIE_DOMAIN, path="/")

def leer_token(request: Request) -> str | None:
    return request.cookies.get(COOKIE_NAME)

def usuario_actual(request: Request, db: Session = Depends(get_db)) -> Usuario:
    token = leer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        uid = data.get("sub")
        if not uid:
            raise HTTPException(status_code=401, detail="Token inválido")
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    usr = db.query(Usuario).filter(Usuario.id == uid).first()
    if not usr:
        raise HTTPException(status_code=401, detail="Usuario no existe")
    return usr

def a_mayusculas(valor: str) -> str:
    return " ".join((valor or "").strip().upper().split())

def token_compartir() -> str:
    t = secrets.token_urlsafe(32)
    return t[:80]