# Panel de gestión de vehículos — configuración

Este documento es la guía única para dejar funcionando el panel `/admin`
de tu web. Son pasos que solo hay que hacer **una vez**. Después de esto,
añadir coches, subir fotos y marcar "vendido" se hace entero desde el
navegador, sin tocar VS Code.

## Qué se ha creado

- `data/vehiculos.json` — los datos de todos los vehículos (ya migrados
  los 5 que tenías).
- `templates/` y `scripts/build.js` — generan automáticamente las páginas
  de cada coche y los listados (home y "coches-tenerife") cada vez que
  hay un cambio. No hay que tocarlos.
- `admin/` — el panel web (se abrirá en `tuweb.vercel.app/admin`).
- `api/` — funciones que el panel usa para guardar cambios y fotos.

Cuando guardas algo desde el panel: se actualiza `data/vehiculos.json`
directamente en GitHub → eso dispara un redeploy en Vercel → Vercel
ejecuta `scripts/build.js` y regenera las páginas → tu web queda
actualizada (tarda entre 30 segundos y 2 minutos).

## Paso 1 — Subir estos archivos a GitHub

Desde VS Code, en el proyecto: revisa los cambios en el panel de Git,
añade todos los archivos nuevos (`admin/`, `api/`, `data/`, `templates/`,
`scripts/`, `package.json`, `vercel.json`) y haz commit + push a `main`
como siempre. Los demás archivos con cambios de línea (`_externos/`,
páginas de categoría, etc.) son ruido de formato del propio entorno, no
hace falta tocarlos.

## Paso 2 — Crear el token de GitHub

El panel necesita permiso para guardar cambios en tu repositorio.

1. Entra en GitHub → tu foto de perfil (arriba a la derecha) →
   **Settings** → en el menú lateral, baja hasta **Developer settings**.
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Nombre: por ejemplo `aglup-motor-admin`.
4. **Repository access**: "Only select repositories" → elige
   `aglup-motor`.
5. **Permissions** → **Repository permissions** → busca **Contents** →
   ponlo en **Read and write**.
6. Genera el token y **cópialo** (solo se muestra una vez).

## Paso 3 — Crear el almacén de fotos (Vercel Blob)

1. Entra en tu proyecto en [vercel.com](https://vercel.com) → pestaña
   **Storage**.
2. **Create Database** → elige **Blob**.
3. Ponle un nombre (por ejemplo `aglup-fotos`) y créalo con acceso
   **Public** (para que las fotos se vean en la web).
4. Cuando te pregunte a qué proyecto conectarlo, conéctalo al proyecto
   de `aglup-motor`. Esto añade automáticamente la variable
   `BLOB_READ_WRITE_TOKEN` — no hay que copiarla a mano.

## Paso 4 — Crear el Deploy Hook

Esto permite que, al guardar cambios en el panel, Vercel reconstruya la
web automáticamente.

1. En el proyecto de Vercel → **Settings** → **Git** → sección
   **Deploy Hooks**.
2. Nombre: `admin-panel`. Rama: `main`.
3. Crea el hook y copia la URL que te da (empieza por
   `https://api.vercel.com/v1/integrations/deploy/...`).

## Paso 5 — Configurar las variables de entorno en Vercel

En el proyecto de Vercel → **Settings** → **Environment Variables**,
añade estas (marca Production, Preview y Development si te lo pregunta):

| Variable | Valor |
|---|---|
| `ADMIN_PASSWORD` | Una contraseña que tú elijas para entrar al panel |
| `GITHUB_TOKEN` | El token que copiaste en el Paso 2 |
| `GITHUB_REPO` | `eduardomaper7-coder/aglup-motor` |
| `GITHUB_BRANCH` | `main` |
| `VERCEL_DEPLOY_HOOK_URL` | La URL del Paso 4 |

`BLOB_READ_WRITE_TOKEN` ya la habrá añadido Vercel solo en el Paso 3.

Después de guardar las variables, haz un **Redeploy** manual una vez
desde la pestaña **Deployments** (los tres puntos → Redeploy) para que
las funciones arranquen ya con esas variables.

## Paso 6 — Usar el panel

Entra en `https://www.aglupmotorcanarias.es/admin/` (o el dominio que
tenga tu proyecto en Vercel), introduce la contraseña del Paso 5, y ya
puedes:

- **Añadir vehículo**: rellenas los datos, arrastras las fotos, guardas.
- **Editar**: cambia cualquier dato o añade/quita fotos.
- **Marcar vendido**: el coche pasa automáticamente al final del listado
  y se le añade una etiqueta roja "Vendido" tanto en la lista como en su
  ficha. Se puede desmarcar igual.
- **Reservar**: etiqueta naranja "Reservado", sin mover el coche de
  sitio.
- **Eliminar**: borra el vehículo y su ficha.

Cada guardado tarda alrededor de un minuto en verse reflejado en la web
(es el tiempo que tarda Vercel en desplegar). El panel te avisa en
pantalla mientras se publica.

## Notas y límites a tener en cuenta

- Las fotos se comprimen automáticamente en el navegador antes de
  subirlas (máx. ~1600px de ancho), así que no hay que preocuparse por
  el tamaño de las fotos del móvil o la cámara.
- El panel no tiene usuarios múltiples, es una contraseña compartida
  única. Si se la das a alguien más del equipo, esa persona podrá editar
  todo el catálogo.
- Los 5 vehículos que ya tenías se han migrado con sus datos y fotos
  originales; el Audi TT ya estaba marcado como "Vendido" y el Opel
  Mokka como "Reservado" en la web original, así que se han mantenido
  así — puedes cambiarlo desde el panel si ya no es así.
- Si algún día quieres cambiar el diseño de las fichas o del listado,
  hay que tocar `templates/vehiculo.tpl.html` y `templates/card.tpl.html`
  (ahí si hace falta código) — pero para el uso del día a día
  (fotos, datos, vendido) no hace falta.
