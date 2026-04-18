# Menú Semanal

Web app responsive (mobile-first) para planificar menús semanales por día, con dos vistas:

- `Menú`: tarjetas de lunes a domingo.
- `Editar semana`: selector semanal visual + formulario diario.

La app usa Firebase Firestore sin autenticación y mantiene la lógica pedida:

- `Roberto` solo se muestra en tarjetas si hay comida o cena.
- Cuando aparece Roberto, se muestra con icono `🥡`.
- `Casa` permite `Texto` o `Fuera` por comida/cena.
- Guardado lazy-write: no crea semanas vacías al abrir.

## Stack

- Vite
- JavaScript modular (ES Modules)
- Firebase Firestore (SDK modular)
- CSS mobile-first

## Ejecutar en local

1. Instala dependencias:

```bash
npm install
```

2. Crea `.env` a partir de `.env.example` y completa tus credenciales Firebase.

3. Ejecuta:

```bash
npm run dev
```

4. Abre la URL que imprime Vite (normalmente `http://localhost:5173`).

## Variables Firebase necesarias

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Extra para el ciclo de turnos:

- `VITE_SHIFT_BASE_DATE` (`YYYY-MM-DD`), donde ese día es el día 1 del ciclo (primera mañana).

## Estructura Firestore

Colección:

- `weeks`

Documento por semana:

- `weekId` (ejemplo: `2026-W16`)

Campos:

- `weekId`
- `startDate`
- `endDate`
- `createdAt`
- `updatedAt`
- `days` (mapa por fecha ISO)

Ejemplo de `days["2026-04-18"]`:

```json
{
  "shift": { "mode": "auto" },
  "roberto": { "comida": "Arroz", "cena": "" },
  "casa": {
    "comida": { "mode": "text", "text": "Lentejas" },
    "cena": { "mode": "fuera", "text": "" }
  },
  "note": "Comprar pan"
}
```

## Lógica 6x6 implementada

Patrón:

1. Mañana
2. Mañana
3. Tarde
4. Tarde
5. Noche
6. Noche
7. Libre
8. Libre
9. Libre
10. Libre
11. Libre
12. Libre

Luego repite.

La app calcula el turno automático para cualquier fecha con la fecha base configurable.

Arquitectura preparada para override manual:

- Si el turno guardado coincide con el automático: `shift.mode = "auto"`.
- Si el usuario cambia turno en formulario: `shift.mode = "manual"` y `shift.value` guarda el valor.

## Lazy-write (importante)

- Al abrir semana inexistente: se renderiza vacía solo en memoria.
- No se crea documento Firestore al navegar o visualizar.
- Solo se crea al primer guardado con contenido real.

Contenido real se considera si existe al menos uno:

- turno con valor
- Roberto comida/cena con texto
- Casa comida/cena en `text` con contenido
- Casa comida/cena en `fuera`
- nota con contenido
