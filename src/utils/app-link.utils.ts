/**
 * Page relais pour les liens ouverts depuis un email/Wave (vérification email,
 * réinitialisation mot de passe, retour paiement) : tente d'ouvrir l'app mobile
 * via le schéma `diwane://`, et si rien ne se passe (desktop, navigateur, ou
 * app non installée), bascule automatiquement vers l'app web Flutter.
 */

const WEB_APP_URL = (process.env.WEB_APP_URL ?? 'https://maxim-flutter.vercel.app').replace(/\/$/, '');

export function webAppUrl(hashRoute: string): string {
  return `${WEB_APP_URL}/#${hashRoute}`;
}

export function appLinkInterstitialHtml(params: {appUrl: string; webUrl: string}): string {
  const {appUrl, webUrl} = params;
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Diwane</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f4f6f9;margin:0}
.box{background:#fff;border-radius:12px;padding:40px;max-width:440px;width:90%;text-align:center;box-shadow:0 2px 12px rgba(0,0,0,.1)}
.spinner{width:32px;height:32px;border:3px solid #e2e8f0;border-top-color:#0f3d5c;border-radius:50%;margin:0 auto 16px;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
p{color:#4a5568}
.btn{display:inline-block;margin-top:12px;padding:12px 24px;background:#0f3d5c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600}
a.secondary{color:#0f3d5c;display:block;margin-top:14px;font-size:14px}</style></head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>Redirection vers Diwane…</p>
  <a class="btn" href="${appUrl}">Ouvrir l'app Diwane</a>
  <a class="secondary" href="${webUrl}">Continuer sur le web</a>
</div>
<script>
  // Tentative automatique — fonctionne sur la plupart des appareils, mais certains
  // navigateurs bloquent silencieusement la redirection vers un schéma personnalisé
  // sans geste utilisateur direct. Dans ce cas la page reste affichée avec les deux
  // boutons ci-dessus comme repli fiable, plutôt que de forcer une redirection web
  // automatique qui empêcherait l'utilisateur de choisir "Ouvrir l'app".
  window.location.href = ${JSON.stringify(appUrl)};
</script>
</body></html>`;
}
