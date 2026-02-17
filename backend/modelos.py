from sqlalchemy import (
    Column, String, Text, Boolean, BigInteger, SmallInteger, ForeignKey,
    Numeric, DateTime, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from db import Base
import uuid

class Usuario(Base):
    __tablename__ = "usuario"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    correo = Column(String, unique=True, nullable=False)
    nombre = Column(String, nullable=True)
    foto = Column(String, nullable=True)
    # OAuth users can exist without local password.
    password = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class UsuarioOAuth(Base):
    __tablename__ = "usuario_oauth"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    proveedor = Column(String(30), nullable=False)
    proveedor_sub = Column(String(200), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    __table_args__ = (
        UniqueConstraint("proveedor", "proveedor_sub", name="ux_oauth_prov_sub"),
        UniqueConstraint("usuario_id", "proveedor", name="ux_oauth_usr_prov"),
    )

class Unidad(Base):
    __tablename__ = "unidad"
    id = Column(SmallInteger, primary_key=True)
    nombre = Column(String(30), unique=True, nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Producto(Base):
    __tablename__ = "producto"
    id = Column(BigInteger, primary_key=True)
    nombre = Column(String(200), nullable=False)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ProductoPrecio(Base):
    __tablename__ = "producto_precio"
    producto_id = Column(BigInteger, ForeignKey("producto.id", ondelete="CASCADE"), primary_key=True)
    precio = Column(BigInteger, nullable=False, server_default="0")
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class Lista(Base):
    __tablename__ = "lista"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(200), nullable=False)
    foto = Column(String, nullable=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ListaUsuario(Base):
    __tablename__ = "lista_usuario"
    id = Column(UUID(as_uuid=True), ForeignKey("lista.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    rol = Column(String(20), nullable=False, server_default="editor")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ListaLink(Base):
    __tablename__ = "lista_link"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lista_id = Column(UUID(as_uuid=True), ForeignKey("lista.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(80), unique=True, nullable=False)
    activo = Column(Boolean, nullable=False, server_default="true")
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

class ListaItem(Base):
    __tablename__ = "lista_item"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lista_id = Column(UUID(as_uuid=True), ForeignKey("lista.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(BigInteger, ForeignKey("producto.id", ondelete="CASCADE"), nullable=False)
    unidad_id = Column(SmallInteger, ForeignKey("unidad.id"))
    cantidad = Column(Numeric(12, 3), nullable=False, server_default="1")
    precio = Column(BigInteger, nullable=False, server_default="0")
    comprado = Column(Boolean, nullable=False, server_default="false")
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("usuario.id"))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("lista_id", "producto_id", name="ux_lista_producto"),
    )

class ItemActividad(Base):
    __tablename__ = "item"
    id = Column(UUID(as_uuid=True), ForeignKey("lista_item.id", ondelete="CASCADE"), primary_key=True)
    usuario_id = Column(UUID(as_uuid=True), ForeignKey("usuario.id", ondelete="CASCADE"), primary_key=True)
    accion = Column(String(20), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
