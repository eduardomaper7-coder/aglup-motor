# Bot de WhatsApp para dar de alta vehículos — configuración

Esta guía es para conectar el número de WhatsApp Business con el bot que ya
está construido (`api/whatsapp-webhook.js`). El bot guía al cliente paso a
paso (fotos, marca, modelo, precio, año, km, potencia, combustible, cambio,
carrocería) y al confirmar crea el vehículo como **borrador pendiente de
revisar** en `/admin` — nunca se publica solo, sin que alguien del equipo lo
apruebe primero.

## Antes de nada

Necesitas una SIM/número de teléfono que **nunca haya estado activo en
WhatsApp normal**. Puede ser una SIM de prepago barata. Ese número quedará
dedicado en exclusiva a esta API (no se puede usar a la vez con la app
normal de WhatsApp).

## Paso 1 — Meta Business Manager y verificación

1. Ve a [business.facebook.com](https://business.facebook.com) e inicia
   sesión con una cuenta de Facebook (personal o de la empresa).
2. Si no existe ya, crea un Business Manager para "AGLUP MOTOR".
3. En **Configuración del negocio** → **Seguridad del negocio** →
   **Verificación del negocio**, empieza el proceso: te pedirá datos y
   documentos del negocio (CIF, dirección, etc.). Puede tardar entre 1 y 5
   días laborables en aprobarse — cuanto antes lo mandes, mejor, porque el
   resto de pasos no funcionan del todo hasta que esté verificado.

## Paso 2 — Crear la app de desarrollador y añadir WhatsApp

1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps)
   → **Crear app** → tipo "Business" (o "Otro" → "Negocio") → asócialo al
   Business Manager del paso 1.
2. Dentro de la app, en el panel de productos, busca **WhatsApp** →
   **Configurar** (Set up).
3. Meta te asigna automáticamente un número de prueba temporal — no lo uses
   para producción, es solo para pruebas rápidas. En la sección **Números
   de teléfono** de WhatsApp, añade tu número real (el de la SIM dedicada):
   sigue el asistente, te llega un código por SMS o llamada al número para
   verificarlo.
4. Una vez añadido, anota dos datos que verás en esa pantalla:
   - **Phone number ID** (un número largo)
   - **WhatsApp Business Account ID** (no lo necesitamos para las variables,
     pero convé anotarlo por si acaso)

## Paso 3 — Generar el token de acceso permanente

El token que te muestra Meta por defecto en la pantalla de pruebas caduca en
24 horas. Para producción hace falta uno permanente:

1. En el Business Manager → **Usuarios del sistema** (System Users) →
   **Añadir** → crea uno con rol "Admin", nombre por ejemplo
   `aglup-whatsapp-bot`.
2. Con ese usuario del sistema seleccionado → **Añadir activos** → elige la
   app que creaste en el Paso 2 → dale permiso "Control total" o al menos
   `whatsapp_business_messaging`.
3. **Generar nuevo token**: elige la app, marca el permiso
   `whatsapp_business_messaging` (y `whatsapp_business_management` si
   aparece), y selecciona la duración "Nunca caduca" si te la ofrece.
4. Copia el token generado (es largo, empieza distinto cada vez) y guárdalo
   en tu bloc de notas — solo se muestra una vez.

## Paso 4 — Variables de entorno en Vercel

En el proyecto de Vercel → **Settings** → **Environment Variables**, añade:

| Variable | Valor |
|---|---|
| `WHATSAPP_TOKEN` | el token permanente del Paso 3 |
| `WHATSAPP_PHONE_NUMBER_ID` | el "Phone number ID" del Paso 2 |
| `WHATSAPP_VERIFY_TOKEN` | invéntate una palabra/frase cualquiera, ej. `aglup2026secreto` |

Guarda y haz un **Redeploy** manual (como hicimos con el resto de variables)
para que las funciones arranquen ya con estas.

## Paso 5 — Configurar el webhook en Meta

1. Vuelve a la app en developers.facebook.com → producto **WhatsApp** →
   **Configuración** (Configuration).
2. En la sección **Webhook**, pulsa **Editar**.
3. **Callback URL**: `https://www.aglupmotorcanarias.es/api/whatsapp-webhook`
4. **Verify token**: la misma palabra que pusiste en `WHATSAPP_VERIFY_TOKEN`
   en el Paso 4 (tiene que ser idéntica).
5. Pulsa **Verificar y guardar** — si las variables de Vercel ya están
   desplegadas, debería verificarse en verde al instante.
6. Justo debajo, en **Campos del webhook** (Webhook fields), busca
   **messages** y actívalo (suscríbete a ese campo). Es el único que
   necesitamos.

## Paso 6 — Probar

Desde tu móvil personal, manda un mensaje al número de WhatsApp Business
nuevo (puedes guardarlo en la agenda como "AGLUP MOTOR Bot" para probarlo
cómodamente). Deberías recibir el mensaje de bienvenida y poder completar
todo el cuestionario. Al confirmar con "SI", entra en `/admin` → sección
**Pendientes de revisar** y compruébalo ahí.

## Nota sobre app en modo desarrollo

Mientras la app esté en modo "Desarrollo" (antes de pasar la revisión de
Meta para uso público), **solo pueden escribirle al número los teléfonos
que añadas como "testers"** en la app (Roles → Testers de WhatsApp). Añade
ahí el número del cliente de AGLUP MOTOR para que pueda probarlo. Si en el
futuro queréis que cualquiera pueda escribirle al bot sin añadirlo a mano,
hay que pasar la revisión de la app ante Meta — para este caso de uso (solo
el cliente fijo del concesionario escribe ahí) probablemente no haga falta
nunca, así que no es un paso urgente.
