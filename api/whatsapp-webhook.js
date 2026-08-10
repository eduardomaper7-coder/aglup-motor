const { put } = require('@vercel/blob');
const { sendText, getMediaUrl, downloadMedia } = require('./_lib/whatsapp');
const { getSession, saveSession, clearSession, mutarSesion } = require('./_lib/sessions');
const { crearVehiculoBorrador } = require('./_lib/vehiculos-store');

// ---------------------------------------------------------------------------
// Bot de WhatsApp: guía al cliente paso a paso para dar de alta un vehículo.
// Los datos se guardan como "borrador" (no se publican) hasta que alguien
// del equipo los revise y los apruebe desde el panel /admin.
// ---------------------------------------------------------------------------

const TEXTOS = {
  bienvenida:
    '¡Hola! Soy el asistente de AGLUP MOTOR 🚗\n\nVamos a dar de alta un vehículo. Mándame las fotos del coche (puedes mandar varias, una a una). Cuando termines, escribe *LISTO*.',
  pideFotoOtraVez: 'Manda al menos una foto y luego escribe *LISTO* para continuar.',
  fotoRecibida: (n) => `Foto ${n} recibida ✅. Manda más fotos o escribe *LISTO* para continuar.`,
  pideTitulo: '¿Marca y modelo del coche? (ejemplo: Audi A1 Adrenalin)',
  pideCategoria: '¿Categoría? Responde: ocasión, segunda mano o seminuevo',
  categoriaInvalida: 'No reconozco esa opción. Responde: ocasión, segunda mano o seminuevo',
  pidePrecio: '¿Precio de venta en euros? (solo el número, ejemplo: 11000)',
  precioInvalido: 'No he entendido el precio. Manda solo el número, ejemplo: 11000',
  pideAnio: '¿Año de matriculación? (ejemplo: 2019)',
  anioInvalido: 'No he entendido el año. Manda solo el número, ejemplo: 2019',
  pideKm: '¿Kilómetros? (solo el número, ejemplo: 120000)',
  kmInvalido: 'No he entendido los kilómetros. Manda solo el número, ejemplo: 120000',
  pidePotencia: '¿Potencia en CV? (solo el número, ejemplo: 150)',
  potenciaInvalida: 'No he entendido la potencia. Manda solo el número, ejemplo: 150',
  pideCombustible: '¿Combustible? Responde: gasolina, diésel, híbrido, eléctrico o glp',
  combustibleInvalido: 'No reconozco ese combustible. Responde: gasolina, diésel, híbrido, eléctrico o glp',
  pideCambio: '¿Cambio? Responde: manual o automático',
  cambioInvalido: 'No reconozco esa opción. Responde: manual o automático',
  pideCarroceria:
    '¿Carrocería? Responde: berlina, suv, compacto, coupe, familiar, monovolumen, furgoneta, pickup o cabrio',
  carroceriaInvalida:
    'No reconozco esa opción. Responde: berlina, suv, compacto, coupe, familiar, monovolumen, furgoneta, pickup o cabrio',
  pideTraccion: '¿Tracción? Responde: delantera, trasera, total o 4x4',
  traccionInvalida: 'No reconozco esa opción. Responde: delantera, trasera, total o 4x4',
  pideConfirmacion: (resumen) => `Resumen:\n\n${resumen}\n\n¿Confirmas? Responde *SI* o *NO*.`,
  confirmacionInvalida: 'Responde *SI* para enviarlo a revisión, o *NO* para cancelar.',
  guardado: '¡Recibido! El equipo lo va a revisar y lo publicará en la web en breve. Gracias 🙌',
  cancelado: 'Vale, lo he cancelado. Si quieres empezar de nuevo, mándame otro mensaje.',
  error: 'Algo ha fallado por mi parte. Escribe cualquier cosa para intentarlo de nuevo.',
};

const COMBUSTIBLES = {
  gasolina: { slug: 'gasolina', texto: 'Gasolina' },
  diesel: { slug: 'diesel', texto: 'Diésel' },
  diésel: { slug: 'diesel', texto: 'Diésel' },
  hibrido: { slug: 'hibrido', texto: 'Híbrido' },
  híbrido: { slug: 'hibrido', texto: 'Híbrido' },
  electrico: { slug: 'electrico', texto: 'Eléctrico' },
  eléctrico: { slug: 'electrico', texto: 'Eléctrico' },
  glp: { slug: 'glp', texto: 'GLP' },
};

const CAMBIOS = {
  manual: { slug: 'manual', texto: 'Manual' },
  automatico: { slug: 'automatico', texto: 'Automático' },
  automático: { slug: 'automatico', texto: 'Automático' },
};

const CARROCERIAS = {
  berlina: 'Berlina',
  cabrio: 'Cabrio',
  compacto: 'Compacto',
  coupe: 'Coupé',
  coupé: 'Coupé',
  familiar: 'Familiar',
  furgoneta: 'Furgoneta',
  monovolumen: 'Monovolumen',
  pickup: 'Pickup',
  suv: 'SUV',
};

const CATEGORIAS = {
  ocasion: 'ocasion',
  'ocasión': 'ocasion',
  'segunda mano': 'segunda-mano',
  segundamano: 'segunda-mano',
  'segunda-mano': 'segunda-mano',
  seminuevo: 'seminuevo',
};
const CATEGORIA_TEXTO = { ocasion: 'Ocasión', 'segunda-mano': 'Segunda mano', seminuevo: 'Seminuevo' };

const TRACCIONES = {
  delantera: { slug: 'delantera', texto: 'Delantera' },
  trasera: { slug: 'trasera', texto: 'Trasera' },
  total: { slug: 'total', texto: 'Total' },
  '4x4': { slug: '4x4', texto: '4x4' },
  '4×4': { slug: '4x4', texto: '4x4' },
};

function normalizar(texto) {
  return String(texto || '')
    .trim()
    .toLowerCase();
}

function soloDigitos(texto) {
  return String(texto || '').replace(/[^0-9]/g, '');
}

function formatearPrecio(digitos) {
  return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function resumenTexto(datos) {
  return (
    `Coche: ${datos.titulo}\n` +
    `Categoría: ${CATEGORIA_TEXTO[datos.categoria] || datos.categoria}\n` +
    `Precio: ${datos.precio} €\n` +
    `Año: ${datos.anio}\n` +
    `Km: ${datos.km}\n` +
    `Potencia: ${datos.potencia}\n` +
    `Combustible: ${datos.combustibles.map((c) => c.texto).join(', ')}\n` +
    `Cambio: ${datos.cambioTexto}\n` +
    `Carrocería: ${datos.carroceriaTexto}\n` +
    `Tracción: ${datos.traccionTexto}`
  );
}

// El identificador incluye un sufijo aleatorio (no solo Date.now()) para que
// dos fotos que lleguen casi a la vez en peticiones distintas nunca choquen.
async function subirFotoWhatsapp(mediaId, telefono) {
  const media = await getMediaUrl(mediaId);
  const buffer = await downloadMedia(media.url);
  const ext = (media.mime_type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
  const sufijo = Math.random().toString(36).slice(2, 8);
  const blob = await put(`vehiculos/whatsapp-${telefono}/${Date.now()}-${sufijo}.${ext}`, buffer, {
    access: 'public',
    contentType: media.mime_type || 'image/jpeg',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blob.url;
}

// Procesa un único mensaje entrante y devuelve el texto (o null) a responder.
async function procesarMensaje(telefono, mensaje) {
  const existente = await getSession(telefono);
  let session = existente
    ? existente.data
    : { step: 'fotos', datos: {}, fotos: [] };
  let sha = existente ? existente.sha : undefined;

  const esNueva = !existente;
  const texto = mensaje.type === 'text' ? normalizar(mensaje.text.body) : null;

  // Primer contacto: da la bienvenida y no procesa nada más en este mensaje.
  if (esNueva) {
    await saveSession(telefono, session);
    return TEXTOS.bienvenida;
  }

  if (session.step === 'fotos') {
    if (mensaje.type === 'image') {
      // Varias fotos pueden llegar como peticiones de webhook casi simultáneas;
      // usamos mutarSesion para no perder ninguna por conflicto de escritura.
      const url = await subirFotoWhatsapp(mensaje.image.id, telefono);
      const actualizada = await mutarSesion(
        telefono,
        () => ({ step: 'fotos', datos: {}, fotos: [] }),
        (s) => ({ ...s, fotos: s.fotos.includes(url) ? s.fotos : [...s.fotos, url] })
      );
      return TEXTOS.fotoRecibida(actualizada.fotos.length);
    }
    if (texto === 'listo') {
      if (session.fotos.length === 0) return TEXTOS.pideFotoOtraVez;
      session.step = 'titulo';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideTitulo;
    }
    return TEXTOS.pideFotoOtraVez;
  }

  if (mensaje.type !== 'text') {
    return 'Por ahora solo puedo leer texto en este paso. ' + TEXTOS.pideFotoOtraVez;
  }

  const original = mensaje.text.body.trim();

  switch (session.step) {
    case 'titulo': {
      if (!original) return TEXTOS.pideTitulo;
      const partes = original.split(/\s+/);
      session.datos.titulo = original;
      session.datos.marca = partes[0] || '';
      session.datos.modelo = partes.slice(1).join(' ');
      session.step = 'categoria';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideCategoria;
    }
    case 'categoria': {
      const clave = normalizar(original);
      const slug = CATEGORIAS[clave];
      if (!slug) return TEXTOS.categoriaInvalida;
      session.datos.categoria = slug;
      session.step = 'precio';
      await saveSession(telefono, session, sha);
      return TEXTOS.pidePrecio;
    }
    case 'precio': {
      const digitos = soloDigitos(original);
      if (!digitos) return TEXTOS.precioInvalido;
      session.datos.precio = formatearPrecio(digitos);
      session.step = 'anio';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideAnio;
    }
    case 'anio': {
      const digitos = soloDigitos(original);
      const anio = parseInt(digitos, 10);
      if (!digitos || anio < 1970 || anio > new Date().getFullYear() + 1) return TEXTOS.anioInvalido;
      session.datos.anio = String(anio);
      session.step = 'km';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideKm;
    }
    case 'km': {
      const digitos = soloDigitos(original);
      if (!digitos) return TEXTOS.kmInvalido;
      session.datos.km = `${digitos} km`;
      session.step = 'potencia';
      await saveSession(telefono, session, sha);
      return TEXTOS.pidePotencia;
    }
    case 'potencia': {
      const digitos = soloDigitos(original);
      if (!digitos) return TEXTOS.potenciaInvalida;
      session.datos.potencia = `${digitos} CV`;
      session.step = 'combustible';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideCombustible;
    }
    case 'combustible': {
      const clave = normalizar(original);
      const encontrado = COMBUSTIBLES[clave];
      if (!encontrado) return TEXTOS.combustibleInvalido;
      session.datos.combustibles = [encontrado];
      session.step = 'cambio';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideCambio;
    }
    case 'cambio': {
      const clave = normalizar(original);
      const encontrado = CAMBIOS[clave];
      if (!encontrado) return TEXTOS.cambioInvalido;
      session.datos.cambio = encontrado.slug;
      session.datos.cambioTexto = encontrado.texto;
      session.step = 'carroceria';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideCarroceria;
    }
    case 'carroceria': {
      const clave = normalizar(original);
      const texto2 = CARROCERIAS[clave];
      if (!texto2) return TEXTOS.carroceriaInvalida;
      session.datos.carroceria = clave === 'coupé' ? 'coupe' : clave;
      session.datos.carroceriaTexto = texto2;
      session.step = 'traccion';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideTraccion;
    }
    case 'traccion': {
      const clave = normalizar(original);
      const encontrado = TRACCIONES[clave];
      if (!encontrado) return TEXTOS.traccionInvalida;
      session.datos.traccion = encontrado.slug;
      session.datos.traccionTexto = encontrado.texto;
      session.step = 'confirmar';
      await saveSession(telefono, session, sha);
      return TEXTOS.pideConfirmacion(resumenTexto(session.datos));
    }
    case 'confirmar': {
      const clave = normalizar(original);
      if (clave === 'si' || clave === 'sí') {
        await crearVehiculoBorrador(session.datos, session.fotos);
        await clearSession(telefono);
        return TEXTOS.guardado;
      }
      if (clave === 'no') {
        await clearSession(telefono);
        return TEXTOS.cancelado;
      }
      return TEXTOS.confirmacionInvalida;
    }
    default: {
      await clearSession(telefono);
      return TEXTOS.bienvenida;
    }
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(String(challenge || ''));
    } else {
      res.status(403).end();
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  // Responder rápido y sin errores es importante: Meta reintenta si no
  // recibe un 200. Cualquier fallo se registra pero no debe romper la
  // respuesta al webhook.
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const value = body?.entry?.[0]?.changes?.[0]?.value;
    const mensajes = value?.messages;

    if (mensajes && mensajes.length) {
      for (const mensaje of mensajes) {
        const telefono = mensaje.from;
        try {
          const respuesta = await procesarMensaje(telefono, mensaje);
          if (respuesta) await sendText(telefono, respuesta);
        } catch (errMensaje) {
          console.error('Error procesando mensaje de WhatsApp:', errMensaje);
          try {
            await sendText(telefono, TEXTOS.error);
          } catch (e2) {
            // no crítico
          }
        }
      }
    }

    res.status(200).end();
  } catch (err) {
    console.error('Error en webhook de WhatsApp:', err);
    // Aun así respondemos 200 para que Meta no reintente en bucle por un
    // payload que no vamos a poder procesar (p.ej. eventos de "statuses").
    res.status(200).end();
  }
};
