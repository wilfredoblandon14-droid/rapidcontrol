export type RolUsuario = "administrador" | "despachador" | "motorizado";

export const nombresRol: Record<RolUsuario, string> = {
  administrador: "Administrador",
  despachador: "Despachador",
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
  return rol === "motorizado" ? "/motorizado" : "/";
}
