-- 00_esquema.sql
-- Esquema principal: listas de mercado compartidas

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Usuarios
CREATE TABLE IF NOT EXISTS usuario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correo          VARCHAR(320) UNIQUE NOT NULL,
  nombre          VARCHAR(120),
  foto            TEXT,
  password        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- OAuth (Google)
CREATE TABLE IF NOT EXISTS usuario_oauth (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  proveedor       VARCHAR(30) NOT NULL,         -- 'google'
  proveedor_sub   VARCHAR(200) NOT NULL,        -- sub del token
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (proveedor, proveedor_sub),
  UNIQUE (usuario_id, proveedor)
);

-- Unidades de medida (catálogo)
CREATE TABLE IF NOT EXISTS unidad (
  id          SMALLSERIAL PRIMARY KEY,
  nombre      VARCHAR(30) UNIQUE NOT NULL,     -- 'Kilo', 'Libra', etc
  usuario_id  UUID REFERENCES usuario(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Productos (catálogo global)
CREATE TABLE IF NOT EXISTS producto (
  id            BIGSERIAL PRIMARY KEY,
  nombre        VARCHAR(200) NOT NULL,
  usuario_id    UUID REFERENCES usuario(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Último precio por producto (COP)
CREATE TABLE IF NOT EXISTS producto_precio (
  producto_id         BIGINT PRIMARY KEY REFERENCES producto(id) ON DELETE CASCADE,
  precio            BIGINT NOT NULL DEFAULT 0,
  usuario_id  UUID REFERENCES usuario(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Listas
CREATE TABLE IF NOT EXISTS lista (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          VARCHAR(200) NOT NULL,
  foto            TEXT,
  usuario_id      UUID NOT NULL REFERENCES usuario(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compartir lista (por usuario)
CREATE TABLE IF NOT EXISTS lista_usuario (
  id        UUID NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  rol             VARCHAR(20) NOT NULL DEFAULT 'editor', -- 'editor'|'lector'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, usuario_id)
);

-- Link para compartir
CREATE TABLE IF NOT EXISTS lista_link (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lista_id        UUID NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  token           VARCHAR(80) UNIQUE NOT NULL,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  usuario_id      UUID REFERENCES usuario(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items dentro de lista (una referencia única por producto)
CREATE TABLE IF NOT EXISTS lista_item (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lista_id        UUID NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  producto_id     BIGINT NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
  unidad_id       SMALLINT REFERENCES unidad(id),
  cantidad        NUMERIC(12,3) NOT NULL DEFAULT 1,
  precio          BIGINT NOT NULL DEFAULT 0,
  comprado        BOOLEAN NOT NULL DEFAULT FALSE,
  usuario_id      UUID REFERENCES usuario(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES usuario(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (lista_id, producto_id)
);

-- Para mostrar “circulitos” de quienes han tocado el item (cantidad/precio/comprado)
CREATE TABLE IF NOT EXISTS item (
  id       UUID NOT NULL REFERENCES lista_item(id) ON DELETE CASCADE,
  usuario_id    UUID NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  accion VARCHAR(20) NOT NULL, -- 'agrego'|'cant'|'precio'|'comprado'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_lista_usr_usuario ON lista_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_item_lista ON lista_item(lista_id);