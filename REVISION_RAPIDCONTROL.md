# Revisión inicial de RapidControl

## Correcciones aplicadas

- Se corrigió el nombre `app/DashboardClient (1).tsx` a `app/DashboardClient.tsx`.
- Se eliminó el duplicado `lib/client (3).ts`.
- Se dejó un solo cliente de Supabase para navegador mediante una instancia singleton.
- `lib/supabase.ts` conserva compatibilidad con las páginas existentes y usa esa misma instancia.
- Se ajustó Login para que `useSearchParams` esté dentro de `Suspense`.
- Se añadió `.env.example` sin secretos.
- Se cambió el idioma raíz del documento a español.

## Verificación pendiente

No fue posible completar `npm ci` en el entorno de revisión porque el registro interno no encontró una dependencia transitiva. Por ello, la compilación final debe ejecutarse localmente con:

```bash
npm install
npm run build
```

## Seguridad

No se incluyó `.env.local`. No publiques claves privadas ni la service role key.
