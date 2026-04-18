# Menu Semanal (version estatica)

Aplicacion web familiar para menus semanales, sin build ni dependencias npm.

## Base tecnica

- HTML + CSS + JavaScript modular
- Firebase Firestore por CDN (sin bundlers)
- GitHub Pages directo (sin Actions, sin dist)

## Archivos principales

- `index.html`
- `styles.css`
- `app.js`
- `firebase-config.js`
- `js/` (modulos de apoyo)

## Como usar

1. Sube estos archivos al repositorio.
2. Publica GitHub Pages desde la rama y carpeta raiz que prefieras (`main` + `/root` suele ser lo mas simple).
3. Abre la URL de Pages.

No hace falta:

- `npm install`
- `npm run build`
- `vite`
- `dist`

## Configuracion de Firebase

Edita `firebase-config.js`:

1. Crea proyecto en Firebase Console.
2. Crea app web.
3. Copia credenciales en `firebaseSetup.config`.
4. Cambia `enabled` a `true`.

Estructura usada en Firestore:

- Coleccion: `weeks`
- Documento por semana (`weekId`, por ejemplo `2026-W16`)
- Campo `days` como mapa por fecha ISO (`YYYY-MM-DD`)

Lazy-write:

- Si una semana no existe, la app la renderiza vacia en memoria.
- Solo crea documento remoto al primer guardado con contenido real.

Si Firebase no esta configurado o falla, la app muestra un aviso visible y sigue en modo local para que no se quede en blanco.

## Turnos 6x6

El turno se calcula automaticamente desde una fecha base configurable (`shiftSetup.baseDate`):

1. Manana
2. Manana
3. Tarde
4. Tarde
5. Noche
6. Noche
7-12. Libre

Luego se repite.

La estructura de datos deja preparada la posibilidad de override manual futuro.

