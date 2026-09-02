import fs from "node:fs";
import path from "path";

/**
 * El guard de migraciones destructivas tiene que estar en el comando que Vercel EJECUTA.
 *
 * Lo que pasó: `package.json` tenía el guard en su script `build`, pero `vercel.json` definía
 * su propio `buildCommand` —sin el guard— y ese es el que Vercel usa. La barrera que el
 * CLAUDE.md declara ("aborta el deploy ante DROP TABLE/COLUMN") NUNCA protegió un deploy.
 *
 * Dos definiciones del mismo build es lo que se desincronizó, así que la regla es: hay una
 * sola. Este test se pone rojo si alguien vuelve a agregar `buildCommand` sin el guard.
 */
describe("el guard de migraciones vive en el build que se ejecuta", () => {
  const raiz = process.cwd();
  const vercel = JSON.parse(fs.readFileSync(path.join(raiz, "vercel.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));

  it("el script `build` de package.json corre el guard antes de migrar", () => {
    const build: string = pkg.scripts.build;
    expect(build).toContain("guard-migrations");
    // Antes de `migrate deploy`: después no serviría de nada, la migración ya corrió.
    expect(build.indexOf("guard-migrations")).toBeLessThan(build.indexOf("migrate deploy"));
  });

  it("vercel.json no pisa el build con un comando propio sin guard", () => {
    // Sin `buildCommand`, Vercel usa el `build` de package.json — que ya está verificado
    // arriba. Si alguien necesita uno propio, tiene que incluir el guard.
    if (vercel.buildCommand !== undefined) {
      expect(vercel.buildCommand).toContain("guard-migrations");
      expect(vercel.buildCommand.indexOf("guard-migrations")).toBeLessThan(
        vercel.buildCommand.indexOf("migrate deploy")
      );
    } else {
      expect(vercel.buildCommand).toBeUndefined();
    }
  });
});
