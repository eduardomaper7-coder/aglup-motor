// Pequeño cliente para leer/escribir ficheros del repositorio de GitHub
// usando la API REST (sin dependencias externas).
//
// Variables de entorno necesarias (se configuran en Vercel):
//   GITHUB_TOKEN   - Personal Access Token con permiso "repo" (contents: write)
//   GITHUB_REPO    - "usuario/repositorio", p.ej. "eduardomaper7-coder/aglup-motor"
//   GITHUB_BRANCH  - rama a usar (opcional, por defecto "main")

const API_BASE = 'https://api.github.com';

function envOrThrow(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}.`);
  return v;
}

async function githubRequest(path, options = {}) {
  const token = envOrThrow('GITHUB_TOKEN');
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'aglup-motor-admin',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json();
}

// Lee un fichero de texto del repo. Devuelve { content, sha } o null si no existe.
async function getFile(filePath) {
  const repo = envOrThrow('GITHUB_REPO');
  const branch = process.env.GITHUB_BRANCH || 'main';
  try {
    const data = await githubRequest(
      `/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${branch}`
    );
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (e) {
    if (String(e.message).startsWith('GitHub API 404')) return null;
    throw e;
  }
}

// Crea o actualiza un fichero de texto en el repo (commit directo a la rama).
async function putFile(filePath, content, message, sha) {
  const repo = envOrThrow('GITHUB_REPO');
  const branch = process.env.GITHUB_BRANCH || 'main';
  return githubRequest(`/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      branch,
      sha: sha || undefined,
    }),
  });
}

// Elimina un fichero del repo.
async function deleteFile(filePath, message, sha) {
  const repo = envOrThrow('GITHUB_REPO');
  const branch = process.env.GITHUB_BRANCH || 'main';
  return githubRequest(`/repos/${repo}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch }),
  });
}

// Dispara el redeploy en Vercel (Deploy Hook configurado en el proyecto).
async function triggerDeploy() {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!url) return { skipped: true };
  const res = await fetch(url, { method: 'POST' });
  return { skipped: false, ok: res.ok, status: res.status };
}

module.exports = { getFile, putFile, deleteFile, triggerDeploy };
