from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from decimal import Decimal

class RegistroIn(BaseModel):
    correo: EmailStr
    password: str = Field(min_length=8)
    nombre: Optional[str] = Field(default=None, max_length=120)

class LoginIn(BaseModel):
    correo: EmailStr
    password: str

class GoogleIn(BaseModel):
    id_token: str

class UsuarioOut(BaseModel):
    id: UUID
    correo: EmailStr
    nombre: Optional[str] = None
    foto: Optional[str] = None

class ListaCrearIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=200)
    foto: Optional[str] = None

class ListaOut(BaseModel):
    id: UUID
    nombre: str
    foto: Optional[str] = None
    es_dueno: bool
    rol: str
    total_refs: int
    total_comprado: int
    total_pendiente: int

class ProductoOut(BaseModel):
    id: int
    nombre: str
    precio_ultimo: int = 0
    unidad_id_ultima: Optional[int] = None
    unidad_ultima: Optional[str] = None

class UnidadOut(BaseModel):
    id: int
    nombre: str

class ItemOut(BaseModel):
    id: UUID
    producto_id: int
    producto: str
    unidad_id: Optional[int] = None
    unidad: Optional[str] = None
    cantidad: Decimal
    precio: int
    comprado: bool
    tocado_por: List[str] = []

class ListaDetalleOut(BaseModel):
    id: UUID
    nombre: str
    foto: Optional[str] = None
    es_dueno: bool
    rol: str
    items: List[ItemOut]
    total_refs: int
    total_comprado: int
    total_pendiente: int

class ItemCrearIn(BaseModel):
    producto: str = Field(min_length=1, max_length=200)  # en MAYÚSCULA
    cantidad: Decimal = Field(default=1, gt=0)
    unidad_id: Optional[int] = None
    precio: int = Field(default=0, ge=0)

class ItemPatchIn(BaseModel):
    cantidad: Optional[Decimal] = Field(default=None, gt=0)
    unidad_id: Optional[int] = None
    precio: Optional[int] = Field(default=None, ge=0)
    comprado: Optional[bool] = None

class LinkOut(BaseModel):
    url: str
    token: str
