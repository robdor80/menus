# Menu Semanal

Web app responsive (mobile-first) para planificar menus semanales por dia.

## Stack

- Vite
- JavaScript modular (ES Modules)
- Firebase Firestore (SDK modular)
- CSS mobile-first

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env` desde `.env.example`.
3. Arrancar:

```bash
npm run dev
```

## Variables de entorno

Requeridas para Firebase:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Opcional para turnos (6x6):

- `VITE_SHIFT_BASE_DATE` (`YYYY-MM-DD`)

## Deploy en GitHub Pages

Este repo esta preparado para publicar en:

- `https://robdor80.github.io/menus/`

Detalles tecnicos:

- `vite.config.js` usa `base: "/menus/"`.
- El workflow `.github/workflows/deploy.yml` construye con Vite y publica el contenido de `dist` en GitHub Pages.
- No hace falta subir `dist` manualmente.

### Secrets de GitHub Actions

En `Settings > Secrets and variables > Actions`, crea:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_SHIFT_BASE_DATE` (opcional)

Si faltan variables de Firebase o falla su inicializacion, la app muestra un error visible en pantalla en lugar de quedarse en blanco.

