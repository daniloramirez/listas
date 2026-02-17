from sqlalchemy.orm import Session
from sqlalchemy import func, case, and_
from uuid import UUID
from modelos import (
    Usuario, UsuarioOAuth, Lista, ListaUsuario, ListaItem, Producto, Unidad,
    ProductoPrecio, ItemActividad, ListaLink
)
from auth import a_mayusculas, token_compartir

def es_dueno(db: Session, lista_id: UUID, usuario_id) -> bool:
    return db.query(Lista).filter(Lista.id == lista_id, Lista.usuario_id == usuario_id).count() == 1

def rol_en_lista(db: Session, lista_id: UUID, usuario_id) -> str | None:
    if es_dueno(db, lista_id, usuario_id):
        return "dueno"
    lu = db.query(ListaUsuario).filter(ListaUsuario.id == lista_id, ListaUsuario.usuario_id == usuario_id).first()
    return lu.rol if lu else None

def requiere_acceso(db: Session, lista_id: UUID, usuario_id) -> str:
    rol = rol_en_lista(db, lista_id, usuario_id)
    if not rol:
        raise ValueError("SIN_ACCESO")
    return rol

def puede_editar(db: Session, lista_id: UUID, usuario_id) -> bool:
    rol = rol_en_lista(db, lista_id, usuario_id)
    return rol in ("dueno", "editor")

def resumen_lista(db: Session, lista_id: UUID):
    total_refs = db.query(func.count(ListaItem.id)).filter(ListaItem.lista_id == lista_id).scalar() or 0
    total_comprado = db.query(func.coalesce(func.sum(ListaItem.precio * ListaItem.cantidad), 0))\
        .filter(ListaItem.lista_id == lista_id, ListaItem.comprado == True).scalar() or 0
    total_pendiente = db.query(func.coalesce(func.sum(ListaItem.precio * ListaItem.cantidad), 0))\
        .filter(ListaItem.lista_id == lista_id, ListaItem.comprado == False).scalar() or 0
    return int(total_refs), int(total_comprado), int(total_pendiente)

def listar_listas(db: Session, usuario_id):
    propias = db.query(Lista).filter(Lista.usuario_id == usuario_id).all()
    compartidas_ids = db.query(ListaUsuario.id).filter(ListaUsuario.usuario_id == usuario_id).all()
    compartidas = db.query(Lista).filter(Lista.id.in_([x[0] for x in compartidas_ids])).all() if compartidas_ids else []

    out = []
    for l in propias:
        tr, tc, tp = resumen_lista(db, l.id)
        out.append((l, True, "dueno", tr, tc, tp))
    for l in compartidas:
        lu = db.query(ListaUsuario).filter(ListaUsuario.id == l.id, ListaUsuario.usuario_id == usuario_id).first()
        rol = lu.rol if lu else "editor"
        tr, tc, tp = resumen_lista(db, l.id)
        out.append((l, False, rol, tr, tc, tp))
    out.sort(key=lambda x: x[0].created_at, reverse=True)
    return out

def crear_lista(db: Session, usuario_id, nombre: str, foto: str | None):
    l = Lista(nombre=nombre.strip(), foto=foto, usuario_id=usuario_id)
    db.add(l)
    db.flush()
    return l

def borrar_lista(db: Session, lista_id: UUID):
    db.query(Lista).filter(Lista.id == lista_id).delete()
    return True

def buscar_productos(db: Session, q: str, limit: int = 10):
    qn = a_mayusculas(q)
    rows = db.query(Producto).filter(Producto.nombre.ilike(f"%{qn}%")).order_by(Producto.nombre.asc()).limit(limit).all()
    out = []
    for p in rows:
        pp = db.query(ProductoPrecio).filter(ProductoPrecio.producto_id == p.id).first()
        unidad_ultima = (
            db.query(ListaItem.unidad_id, Unidad.nombre)
            .outerjoin(Unidad, Unidad.id == ListaItem.unidad_id)
            .filter(
                ListaItem.producto_id == p.id,
                ListaItem.unidad_id.isnot(None),
            )
            .order_by(ListaItem.updated_at.desc(), ListaItem.created_at.desc())
            .first()
        )
        uid = unidad_ultima[0] if unidad_ultima else None
        unom = unidad_ultima[1] if unidad_ultima else None
        out.append((p, pp.precio if pp else 0, uid, unom))
    return out

def crear_o_obtener_producto(db: Session, usuario_id, nombre: str) -> Producto:
    n = a_mayusculas(nombre)
    p = db.query(Producto).filter(Producto.nombre == n).first()
    if p:
        return p
    p = Producto(nombre=n, usuario_id=usuario_id)
    db.add(p)
    db.flush()
    return p

def registrar_ultimo_precio(db: Session, producto_id: int, precio: int, usuario_id):
    if precio is None:
        return
    if precio < 0:
        return
    pp = db.query(ProductoPrecio).filter(ProductoPrecio.producto_id == producto_id).first()
    if not pp:
        pp = ProductoPrecio(producto_id=producto_id, precio=precio, usuario_id=usuario_id)
        db.add(pp)
    else:
        pp.precio = precio
        pp.usuario_id = usuario_id
    return pp

def item_tocados(db: Session, item_id):
    # devuelve lista de nombres (para circulitos)
    rows = db.query(Usuario.nombre, Usuario.correo)\
        .join(ItemActividad, ItemActividad.usuario_id == Usuario.id)\
        .filter(ItemActividad.id == item_id)\
        .all()
    res = []
    for n, c in rows:
        res.append(n or c.split("@")[0].upper())
    return res[:6]

def agregar_item(db: Session, lista_id: UUID, usuario_id, producto: str, cantidad, unidad_id, precio: int):
    p = crear_o_obtener_producto(db, usuario_id, producto)
    # Evitar duplicado por regla
    existente = db.query(ListaItem).filter(ListaItem.lista_id == lista_id, ListaItem.producto_id == p.id).first()
    if existente:
        raise ValueError("ITEM_DUPLICADO")

    it = ListaItem(
        lista_id=lista_id,
        producto_id=p.id,
        unidad_id=unidad_id,
        cantidad=cantidad,
        precio=precio or 0,
        comprado=False,
        usuario_id=usuario_id,
        updated_by=usuario_id,
    )
    db.add(it)
    db.flush()

    # actividad
    act = ItemActividad(id=it.id, usuario_id=usuario_id, accion="agrego")
    db.add(act)

    if precio and precio > 0:
        registrar_ultimo_precio(db, p.id, precio, usuario_id)

    return it, p

def patch_item(db: Session, lista_id: UUID, item_id: UUID, usuario_id, patch: dict):
    it = db.query(ListaItem).filter(ListaItem.id == item_id, ListaItem.lista_id == lista_id).first()
    if not it:
        raise ValueError("NO_EXISTE")

    accion = None
    if patch.get("cantidad") is not None:
        it.cantidad = patch["cantidad"]
        accion = "cant"
    if patch.get("unidad_id") is not None:
        it.unidad_id = patch["unidad_id"]
    if patch.get("precio") is not None:
        it.precio = patch["precio"]
        accion = "precio"
        if it.precio >= 0:
            registrar_ultimo_precio(db, it.producto_id, int(it.precio), usuario_id)
    if patch.get("comprado") is not None:
        it.comprado = patch["comprado"]
        accion = "comprado"

    it.updated_by = usuario_id
    it.updated_at = func.now()

    if accion:
        # UPSERT actividad (PK compuesta item_id + usuario_id)
        act = db.query(ItemActividad).filter(ItemActividad.id == item_id, ItemActividad.usuario_id == usuario_id).first()
        if not act:
            act = ItemActividad(id=item_id, usuario_id=usuario_id, accion=accion)
            db.add(act)
        else:
            act.accion = accion
            act.updated_at = func.now()

    return it

def borrar_item(db: Session, lista_id: UUID, item_id: UUID):
    db.query(ListaItem).filter(ListaItem.id == item_id, ListaItem.lista_id == lista_id).delete()
    return True

def crear_link(db: Session, lista_id: UUID, usuario_id, rol: str = "editor"):
    rol = (rol or "editor").lower()
    prefijo = "l_" if rol == "lector" else "e_"
    t = f"{prefijo}{token_compartir()[:78]}"
    lk = ListaLink(lista_id=lista_id, token=t, activo=True, usuario_id=usuario_id)
    db.add(lk)
    db.flush()
    return lk

def aceptar_link(db: Session, token: str, usuario_id):
    lk = db.query(ListaLink).filter(ListaLink.token == token, ListaLink.activo == True).first()
    if not lk:
        raise ValueError("LINK_INVALIDO")

    # si es dueño, no hace falta
    l = db.query(Lista).filter(Lista.id == lk.lista_id).first()
    if not l:
        raise ValueError("LINK_INVALIDO")

    if l.usuario_id == usuario_id:
        return lk.lista_id, "dueno"

    rol_link = "lector" if (lk.token or "").startswith("l_") else "editor"

    # agregar/actualizar rol según enlace
    existe = db.query(ListaUsuario).filter(ListaUsuario.id == lk.lista_id, ListaUsuario.usuario_id == usuario_id).first()
    if not existe:
        db.add(ListaUsuario(id=lk.lista_id, usuario_id=usuario_id, rol=rol_link))
    elif existe.rol != rol_link:
        existe.rol = rol_link
    return lk.lista_id, rol_link
