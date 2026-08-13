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
p{color:#4a5568}a{color:#0f3d5c}</style></head>
<body>
<div class="box">
  <div class="spinner"></div>
  <p>Redirection vers Diwane…</p>
  <p><a href="${webUrl}">Cliquez ici si rien ne se passe</a></p>
</div>
<script>
  var webUrl = ${JSON.stringify(webUrl)};
  var switchedAway = false;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) switchedAway = true;
  });
  window.location.href = ${JSON.stringify(appUrl)};
  setTimeout(function () {
    if (!switchedAway) window.location.href = webUrl;
  }, 1200);
</script>
</body></html>`;
}
