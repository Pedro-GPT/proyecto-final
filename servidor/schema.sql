-- Ranking de "Las dos puertas": una fila por nombre (en minúsculas), con su mejor tiempo.
CREATE TABLE IF NOT EXISTS tiempos (
  clave  TEXT PRIMARY KEY,   -- nombre en minúsculas
  nombre TEXT NOT NULL,      -- como lo escribió en su mejor partida
  ms     INTEGER NOT NULL,   -- mejor tiempo en milisegundos
  fecha  INTEGER NOT NULL    -- cuándo lo hizo (reloj del servidor)
);
