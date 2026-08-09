// Comprueba la contraseña de administrador enviada en la cabecera
// "x-admin-password". La contraseña real vive en la variable de entorno
// ADMIN_PASSWORD de Vercel (no en el código).
function checkAuth(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({
      error: 'El servidor no tiene configurada la variable de entorno ADMIN_PASSWORD.',
    });
    return false;
  }
  const provided = req.headers['x-admin-password'];
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Contraseña incorrecta.' });
    return false;
  }
  return true;
}

module.exports = { checkAuth };
