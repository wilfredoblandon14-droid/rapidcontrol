export type RolUsuario = "administrador" | "despachador" | "motorizado";

export const nombresRol: Record<RolUsuario, string> = {
  administrador: "Administrador",
  despachador: "Operador de turno",
  motorizado: "Motorizado",
};

export function esRolUsuario(valor: unknown): valor is RolUsuario {
  return (
    valor === "administrador" ||
    valor === "despachador" ||
    valor === "motorizado"
  );
}

export function rutaInicialPorRol(rol: RolUsuario) {
  if (rol === "motorizado") return "/motorizado";
  if (rol === "despachador") return "/operaciones";
  return "/";
}
