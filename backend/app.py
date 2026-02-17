import os
from urllib.parse import urlsplit
from fastapi import FastAPI, Depends, HTTPException, Response, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from db import get_db, engine
from modelos import Usuario, UsuarioOAuth, Lista, ListaItem, Producto, Unidad
from esquemas import (
    RegistroIn, LoginIn, GoogleIn, UsuarioOut,
    ListaCrearIn, ListaOut, ListaDetalleOut,
    ItemCrearIn, ItemPatchIn, LinkOut, ProductoOut, UnidadOut
)
from auth import (
    hash_password, verify_password, crear_token, set_cookie, clear_cookie,
    usuario_actual, a_mayusculas
)
import crud

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5174")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_parsed_app_base = urlsplit(APP_BASE_URL)
APP_ORIGIN = f"{_parsed_app_base.scheme}://{_parsed_app_base.netloc}" if _parsed_app_base.scheme and _parsed_app_base.netloc else ""

app = FastAPI()


def aplicar_migraciones_compatibilidad():
    """
    Compatibilidad para entornos ya desplegados sin Alembic:
    - Corrige typo `lista.usuario_ud` -> `lista.usuario_id`.
    - Asegura `created_at` en tablas usadas por ORM.
    - Permite `usuario.password` nullable (usuarios OAuth).
    """
    with engine.begin() as conn:
        conn.execute(text("""
DO $$
BEGIN
  IF to_regclass('public.lista') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lista'
        AND column_name = 'usuario_ud'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lista'
        AND column_name = 'usuario_id'
    ) THEN
      ALTER TABLE public.lista RENAME COLUMN usuario_ud TO usuario_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lista'
        AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.lista
      ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
  END IF;

  IF to_regclass('public.usuario') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'usuario'
        AND column_name = 'created_at'
    ) THEN
      ALTER TABLE public.usuario
      ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'usuario'
        AND column_name = 'password'
    ) THEN
      ALTER TABLE public.usuario ALTER COLUMN password DROP NOT NULL;
    END IF;
  END IF;
END
$$;
        """))
        conn.execute(text("""
INSERT INTO public.producto (nombre, usuario_id)
SELECT p.nombre, NULL::uuid
FROM (VALUES
  ('AREPAS'),
  ('HUEVOS'),
  ('ARROZ'),
  ('FRIJOL'),
  ('LENTEJA'),
  ('ACEITE'),
  ('SAL'),
  ('AZUCAR'),
  ('PANELA'),
  ('CAFE'),
  ('LECHE'),
  ('QUESO'),
  ('MANTEQUILLA'),
  ('POLLO'),
  ('CARNE DE RES'),
  ('CHORIZO'),
  ('PAPA'),
  ('PLATANO'),
  ('YUCA'),
  ('TOMATE'),
  ('CEBOLLA'),
  ('AJO'),
  ('CILANTRO'),
  ('ZANAHORIA'),
  ('BANANO'),
  ('NARANJA')
) AS p(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM public.producto e WHERE e.nombre = p.nombre
);
        """))


@app.on_event("startup")
def startup_compat():
    aplicar_migraciones_compatibilidad()

# CORS (para dev con Vite + cookies)
origins = [
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://192.168.78.151:5174",
    "https://decoralco.com",
]
if APP_ORIGIN and APP_ORIGIN not in origins:
    origins.append(APP_ORIGIN)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/listas/health")
def health():
    return {"ok": True}

# ---------------- AUTH ----------------
@app.post("/api/listas/auth/registro", response_model=UsuarioOut)
def registro(payload: RegistroIn, response: Response, db: Session = Depends(get_db)):
    correo = payload.correo.lower().strip()
    if db.query(Usuario).filter(Usuario.correo == correo).first():
        raise HTTPException(status_code=400, detail="El correo ya existe")

    u = Usuario(correo=correo, nombre=payload.nombre, password=hash_password(payload.password))
    db.add(u)
    db.flush()

    token = crear_token(str(u.id))
    set_cookie(response, token)
    db.commit()
    return UsuarioOut(id=u.id, correo=u.correo, nombre=u.nombre, foto=u.foto)

@app.post("/api/listas/auth/login", response_model=UsuarioOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    correo = payload.correo.lower().strip()
    u = db.query(Usuario).filter(Usuario.correo == correo).first()
    if not u or not u.password or not verify_password(payload.password, u.password):
        raise HTTPException(status_code=400, detail="Credenciales inválidas")

    token = crear_token(str(u.id))
    set_cookie(response, token)
    return UsuarioOut(id=u.id, correo=u.correo, nombre=u.nombre, foto=u.foto)

@app.post("/api/listas/auth/google", response_model=UsuarioOut)
def login_google(payload: GoogleIn, response: Response, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID or "TU_CLIENT_ID" in GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID no configurado")

    try:
        info = google_id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Token de Google inválido")

    sub = info.get("sub")
    email = (info.get("email") or "").lower().strip()
    name = info.get("name")
    picture = info.get("picture")

    if not sub or not email:
        raise HTTPException(status_code=400, detail="Google no entregó email/sub")

    link = db.query(UsuarioOAuth).filter(
        UsuarioOAuth.proveedor == "google",
        UsuarioOAuth.proveedor_sub == sub
    ).first()

    if link:
        u = db.query(Usuario).filter(Usuario.id == link.usuario_id).first()
    else:
        u = db.query(Usuario).filter(Usuario.correo == email).first()
        if not u:
            u = Usuario(correo=email, nombre=name, foto=picture)
            db.add(u)
            db.flush()

        link = UsuarioOAuth(usuario_id=u.id, proveedor="google", proveedor_sub=sub)
        db.add(link)

    # refresca perfil
    if name and not u.nombre:
        u.nombre = name
    if picture and not u.foto:
        u.foto = picture

    db.commit()
    token = crear_token(str(u.id))
    set_cookie(response, token)
    return UsuarioOut(id=u.id, correo=u.correo, nombre=u.nombre, foto=u.foto)

@app.post("/api/listas/auth/logout")
def logout(response: Response):
    clear_cookie(response)
    return {"ok": True}

@app.get("/api/listas/me", response_model=UsuarioOut)
def me(u: Usuario = Depends(usuario_actual)):
    return UsuarioOut(id=u.id, correo=u.correo, nombre=u.nombre, foto=u.foto)

# ---------------- PRODUCTOS (autocomplete) ----------------
@app.get("/api/listas/productos", response_model=list[ProductoOut])
def productos(q: str = "", db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    rows = crud.buscar_productos(db, q, 12)
    return [
        ProductoOut(
            id=p.id,
            nombre=p.nombre,
            precio_ultimo=precio,
            unidad_id_ultima=uid,
            unidad_ultima=unom,
        )
        for p, precio, uid, unom in rows
    ]

@app.get("/api/listas/unidades", response_model=list[UnidadOut])
def unidades(q: str = "", db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    qn = a_mayusculas(q or "")
    query = db.query(Unidad)
    if qn:
        query = query.filter(Unidad.nombre.ilike(f"%{qn}%"))
    rows = query.order_by(Unidad.nombre.asc()).limit(20).all()
    return [UnidadOut(id=x.id, nombre=x.nombre) for x in rows]

# ---------------- LISTAS ----------------
@app.get("/api/listas/listas", response_model=list[ListaOut])
def listas(db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    data = crud.listar_listas(db, u.id)
    out = []
    for l, es_dueno, rol, tr, tc, tp in data:
        out.append(ListaOut(
            id=l.id, nombre=l.nombre, foto=l.foto,
            es_dueno=es_dueno, rol=rol,
            total_refs=tr, total_comprado=tc, total_pendiente=tp
        ))
    return out

@app.post("/api/listas/listas", response_model=ListaOut)
def crear_lista(payload: ListaCrearIn, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    nombre = payload.nombre.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail="Nombre requerido")
    l = crud.crear_lista(db, u.id, nombre, payload.foto)
    db.commit()
    tr, tc, tp = crud.resumen_lista(db, l.id)
    return ListaOut(id=l.id, nombre=l.nombre, foto=l.foto, es_dueno=True, rol="dueno",
                   total_refs=tr, total_comprado=tc, total_pendiente=tp)

@app.get("/api/listas/listas/{lista_id}", response_model=ListaDetalleOut)
def detalle(lista_id, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    try:
        rol = crud.requiere_acceso(db, lista_id, u.id)
    except ValueError:
        raise HTTPException(status_code=403, detail="Sin acceso")

    l = db.query(Lista).filter(Lista.id == lista_id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Lista no existe")

    # items + joins básicos
    items = db.query(ListaItem, Producto.nombre, Unidad.nombre)\
        .join(Producto, Producto.id == ListaItem.producto_id)\
        .outerjoin(Unidad, Unidad.id == ListaItem.unidad_id)\
        .filter(ListaItem.lista_id == lista_id)\
        .order_by(Producto.nombre.asc())\
        .all()

    out_items = []
    for it, pnom, unom in items:
        tocados = crud.item_tocados(db, it.id)
        out_items.append({
            "id": it.id,
            "producto_id": it.producto_id,
            "producto": pnom,
            "unidad_id": it.unidad_id,
            "unidad": unom,
            "cantidad": it.cantidad,
            "precio": int(it.precio),
            "comprado": it.comprado,
            "tocado_por": tocados,
        })

    tr, tc, tp = crud.resumen_lista(db, lista_id)
    es_dueno = (l.usuario_id == u.id)
    rol_out = "dueno" if es_dueno else rol
    return {
        "id": l.id, "nombre": l.nombre, "foto": l.foto,
        "es_dueno": es_dueno, "rol": rol_out,
        "items": out_items,
        "total_refs": tr, "total_comprado": tc, "total_pendiente": tp
    }

@app.delete("/api/listas/listas/{lista_id}")
def eliminar_lista(lista_id, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    if not crud.es_dueno(db, lista_id, u.id):
        raise HTTPException(status_code=403, detail="Solo el dueño puede eliminar la lista")
    crud.borrar_lista(db, lista_id)
    db.commit()
    return {"ok": True}

# ---------------- ITEMS ----------------
@app.post("/api/listas/listas/{lista_id}/items")
def crear_item(lista_id, payload: ItemCrearIn, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    if not crud.puede_editar(db, lista_id, u.id):
        raise HTTPException(status_code=403, detail="Sin permiso para editar")

    prod = a_mayusculas(payload.producto)
    try:
        it, p = crud.agregar_item(db, lista_id, u.id, prod, payload.cantidad, payload.unidad_id, payload.precio)
    except ValueError as e:
        if str(e) == "ITEM_DUPLICADO":
            raise HTTPException(status_code=400, detail="Ese producto ya está en la lista")
        raise

    db.commit()
    return {"ok": True, "item_id": str(it.id)}

@app.patch("/api/listas/listas/{lista_id}/items/{item_id}")
def editar_item(lista_id, item_id, payload: ItemPatchIn, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    if not crud.puede_editar(db, lista_id, u.id):
        raise HTTPException(status_code=403, detail="Sin permiso para editar")

    patch = payload.model_dump(exclude_unset=True)
    try:
        crud.patch_item(db, lista_id, item_id, u.id, patch)
    except ValueError:
        raise HTTPException(status_code=404, detail="Item no existe")
    db.commit()
    return {"ok": True}

@app.delete("/api/listas/listas/{lista_id}/items/{item_id}")
def borrar_item(lista_id, item_id, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    # dueño o editor pueden borrar items
    rol = crud.rol_en_lista(db, lista_id, u.id)
    if rol not in ("dueno", "editor"):
        raise HTTPException(status_code=403, detail="Sin permiso")
    crud.borrar_item(db, lista_id, item_id)
    db.commit()
    return {"ok": True}

# ---------------- COMPARTIR ----------------
@app.post("/api/listas/listas/{lista_id}/compartir/link", response_model=LinkOut)
def crear_link(lista_id, rol: str = Query(default="editor"), db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    if not crud.puede_editar(db, lista_id, u.id):
        raise HTTPException(status_code=403, detail="Sin permiso")
    rol = (rol or "editor").lower()
    if rol not in ("editor", "lector"):
        raise HTTPException(status_code=400, detail="Rol inválido")
    lk = crud.crear_link(db, lista_id, u.id, rol)
    db.commit()
    base = APP_BASE_URL.rstrip("/")
    url = f"{base}/compartir/{lk.token}" if base.endswith("/listas") else f"{base}/listas/compartir/{lk.token}"
    return LinkOut(url=url, token=lk.token)

@app.post("/api/listas/aceptar/{token}")
def aceptar(token: str, db: Session = Depends(get_db), u: Usuario = Depends(usuario_actual)):
    try:
        lista_id, rol = crud.aceptar_link(db, token, u.id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Link inválido o inactivo")
    db.commit()
    return {"ok": True, "lista_id": str(lista_id), "rol": rol}
