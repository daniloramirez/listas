-- 01_semillas.sql
INSERT INTO unidad (nombre) VALUES
('UNIDAD'),
('KILO'),
('LIBRA'),
('BOLSA'),
('PACA'),
('GRAMO'),
('LITRO'),
('MILILITRO'),
('CAJA'),
('PAQUETE'),
('BOTELLA'),
('DOCENA')
ON CONFLICT (nombre) DO NOTHING;
