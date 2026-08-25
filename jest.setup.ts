// El `.env` primero: sin él, cualquier suite que toque `lib/prisma` no llega a correr.
require("./scripts/load-env.js");

process.env.SESSION_SECRET = "test-secret-de-al-menos-32-caracteres-para-pruebas";
