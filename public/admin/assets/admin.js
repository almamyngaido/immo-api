// ── Config ────────────────────────────────────────────────────────────────────
const API = window.location.origin;

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('diwane_admin_token'); }
function setToken(t) { localStorage.setItem('diwane_admin_token', t); }
function clearToken() { localStorage.removeItem('diwane_admin_token'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function requireAuth() {
  if (!getToken()) { window.location.href = '/admin/index.html'; }
}

function logout() {
  clearToken();
  window.location.href = '/admin/index.html';
}

// ── API calls ─────────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  if (res.status === 401) { logout(); return; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || data.message || `Erreur ${res.status}`);
  return data;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
function lightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}" alt="Document CNI">`;
  lb.onclick = () => lb.remove();
  document.body.appendChild(lb);
}

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function pillStatut(s) {
  const labels = { en_attente: 'En attente', en_cours: 'En cours', verifie: 'Vérifié', rejete: 'Rejeté', non_soumis: 'Non soumis' };
  return `<span class="pill ${s}">${labels[s] || s}</span>`;
}
function pillPlan(p) {
  const labels = { gratuit: 'Gratuit', premium: 'Premium', pro: 'Pro' };
  return `<span class="pill ${p}">${labels[p] || p}</span>`;
}
function stars(n) {
  return '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));
}

// ── ══════════════════════════════════════════════════════════════════════════
//    LOGIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
async function doLogin() {
  const btn = document.getElementById('login-btn');
  const errDiv = document.getElementById('error-msg');
  if (!btn || !errDiv) return;
  errDiv.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Connexion…';

  try {
    const res = await fetch(`${API}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: document.getElementById('email').value.trim(),
        mot_de_passe: document.getElementById('password').value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || data.message || 'Identifiants invalides');
    if (data.user?.role !== 'admin') throw new Error('Accès réservé aux administrateurs');
    setToken(data.token);
    window.location.href = '/admin/dashboard.html';
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Se connecter';
  }
}

if (document.getElementById('login-form')) {
  if (getToken()) window.location.href = '/admin/dashboard.html';
  document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); doLogin(); });
}

// ── ══════════════════════════════════════════════════════════════════════════
//    MODAL VÉRIFICATION — global (utilisé sur dashboard + courtiers)
// ═════════════════════════════════════════════════════════════════════════════
let _currentCourtierId = null;

function _injectModalIfAbsent() {
  if (document.getElementById('modal-verification')) return;
  const div = document.createElement('div');
  div.innerHTML = `
  <div id="modal-verification" class="modal hidden">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <h2 id="modal-courtier-nom">Vérification</h2>
          <span id="modal-statut-actuel"></span>
        </div>
        <button onclick="fermerModal()" class="btn-close">✕</button>
      </div>
      <div class="modal-body">
        <div class="courtier-info">
          <p><strong>Email :</strong> <span id="modal-email">—</span></p>
          <p><strong>Téléphone :</strong> <span id="modal-telephone">—</span></p>
          <p><strong>Soumis le :</strong> <span id="modal-date">—</span></p>
        </div>
        <div class="documents-section">
          <h3>Documents soumis</h3>
          <div class="docs-grid">
            <div><p class="doc-label">CNI Recto</p><div id="modal-cni-recto"><div class="doc-loading">Chargement…</div></div></div>
            <div><p class="doc-label">CNI Verso</p><div id="modal-cni-verso"><div class="doc-loading">Chargement…</div></div></div>
          </div>
          <div id="modal-registre"></div>
        </div>
        <div class="action-section">
          <h3>Décision</h3>
          <textarea id="modal-note" class="note-input" rows="2" placeholder="Motif du rejet (obligatoire en cas de rejet)…"></textarea>
          <div class="action-btns" style="margin-top:12px">
            <button class="btn-sm btn-approve" onclick="approuver()">✓ Approuver</button>
            <button class="btn-sm btn-reject" onclick="rejeter()">✕ Rejeter</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div.firstElementChild);
  document.getElementById('modal-verification').addEventListener('click', function(e) {
    if (e.target === this) fermerModal();
  });
}

window.ouvrirModal = async function(courtierId) {
  _injectModalIfAbsent();
  _currentCourtierId = courtierId;
  document.getElementById('modal-verification').classList.remove('hidden');
  document.getElementById('modal-note').value = '';
  document.getElementById('modal-cni-recto').innerHTML = '<div class="doc-loading">Chargement…</div>';
  document.getElementById('modal-cni-verso').innerHTML = '<div class="doc-loading">Chargement…</div>';
  document.getElementById('modal-registre').innerHTML = '';
  document.getElementById('modal-statut-actuel').innerHTML = '';

  try {
    const data = await api('GET', `/api/admin/courtiers/${courtierId}/verification/documents`);
    const c = data.courtier;
    document.getElementById('modal-courtier-nom').textContent = `${c.prenom} ${c.nom}`;
    document.getElementById('modal-email').textContent = c.email;
    document.getElementById('modal-telephone').textContent = c.telephone || '—';
    document.getElementById('modal-date').textContent = fmtDateTime(c.date_soumission);
    document.getElementById('modal-statut-actuel').innerHTML = pillStatut(c.statut_verification);

    const makeImg = (url, label) => url
      ? `<img src="${url}" class="doc-img" alt="${label}" onclick="lightbox('${url}')" onerror="this.outerHTML='<div class=doc-error>Impossible de charger l\\'image</div>'">`
      : `<div class="doc-error">Document non soumis</div>`;

    document.getElementById('modal-cni-recto').innerHTML = makeImg(data.cni_recto_url, 'CNI Recto');
    document.getElementById('modal-cni-verso').innerHTML = makeImg(data.cni_verso_url, 'CNI Verso');
    document.getElementById('modal-registre').innerHTML = data.registre_commerce_url
      ? `<div><p class="doc-label">Registre de Commerce</p>${makeImg(data.registre_commerce_url, 'Registre')}</div>` : '';
  } catch (e) {
    document.getElementById('modal-cni-recto').innerHTML = `<div class="doc-error">${e.message}</div>`;
  }
};

window.fermerModal = function() {
  const modal = document.getElementById('modal-verification');
  if (modal) modal.classList.add('hidden');
  _currentCourtierId = null;
};

window.approuver = async function() {
  if (!_currentCourtierId) return;
  if (!confirm('Confirmer la vérification de ce courtier ?')) return;
  try {
    await api('PATCH', `/api/admin/courtiers/${_currentCourtierId}/verification`, { statut: 'verifie' });
    toast('Courtier vérifié avec succès ✓');
    fermerModal();
    if (typeof chargerCourtiers === 'function') chargerCourtiers();
    if (typeof chargerDashboard === 'function') chargerDashboard();
  } catch (e) { toast(e.message, 'error'); }
};

window.rejeter = async function() {
  if (!_currentCourtierId) return;
  const note = document.getElementById('modal-note').value.trim();
  if (!note) { toast('Veuillez indiquer le motif du rejet', 'error'); document.getElementById('modal-note').focus(); return; }
  if (!confirm('Confirmer le rejet de ce courtier ?')) return;
  try {
    await api('PATCH', `/api/admin/courtiers/${_currentCourtierId}/verification`, { statut: 'rejete', admin_note: note });
    toast('Dossier rejeté');
    fermerModal();
    if (typeof chargerCourtiers === 'function') chargerCourtiers();
    if (typeof chargerDashboard === 'function') chargerDashboard();
  } catch (e) { toast(e.message, 'error'); }
};

// ── ══════════════════════════════════════════════════════════════════════════
//    DASHBOARD PAGE
// ═════════════════════════════════════════════════════════════════════════════
if (document.getElementById('nb-courtiers') !== null && document.getElementById('verifications-list')) {
  requireAuth();
  document.getElementById('logout-link')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  window.chargerDashboard = async function chargerDashboard() {
    try {
      const stats = await api('GET', '/api/admin/stats');
      document.getElementById('nb-courtiers').textContent = stats.nb_courtiers ?? '—';
      document.getElementById('nb-en-attente').textContent = stats.nb_verifications_en_attente ?? '—';
      document.getElementById('nb-verifies').textContent = stats.nb_courtiers_verifies ?? '—';
      document.getElementById('nb-biens').textContent = stats.nb_biens_actifs ?? '—';
      document.getElementById('nb-avis-attente').textContent = stats.nb_avis_en_attente ?? '—';
      document.getElementById('revenus').textContent = stats.revenus_mois
        ? stats.revenus_mois.toLocaleString('fr-FR') : '—';

      const badge = document.getElementById('badge-attente');
      if (badge && stats.nb_verifications_en_attente > 0)
        badge.textContent = stats.nb_verifications_en_attente;
    } catch (e) {
      console.error('Stats error', e);
    }

    try {
      const verifs = await api('GET', '/api/admin/verifications');
      const pending = verifs.filter(v => v.statut_verification === 'en_attente' || v.statut_verification === 'en_cours');
      const list = document.getElementById('verifications-list');
      if (!pending.length) {
        list.innerHTML = '<p class="empty">Aucune vérification en attente ✓</p>';
        return;
      }
      list.innerHTML = `<table>
        <thead><tr><th>Courtier</th><th>Email</th><th>Soumis le</th><th>Action</th></tr></thead>
        <tbody>${pending.map(c => `
          <tr>
            <td><strong>${c.prenom} ${c.nom}</strong></td>
            <td>${c.email}</td>
            <td>${fmtDate(c.date_soumission)}</td>
            <td><button class="btn-sm btn-review" onclick="ouvrirModal('${c.id}')">Examiner</button></td>
          </tr>`).join('')}</tbody>
      </table>`;
    } catch (e) {
      document.getElementById('verifications-list').innerHTML = '<p class="loading">Erreur de chargement</p>';
    }
  };
  chargerDashboard();
}

// ── ══════════════════════════════════════════════════════════════════════════
//    COURTIERS PAGE
// ═════════════════════════════════════════════════════════════════════════════
if (document.getElementById('courtiers-list') && document.getElementById('filter-statut')) {
  requireAuth();
  document.getElementById('logout-link')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  window.chargerCourtiers = async function() {
    const statut = document.getElementById('filter-statut').value;
    const list = document.getElementById('courtiers-list');
    list.innerHTML = '<p class="loading">Chargement…</p>';

    try {
      let courtiers = await api('GET', '/api/admin/verifications');

      if (statut !== 'tous') {
        courtiers = courtiers.filter(c => c.statut_verification === statut);
      }

      if (!courtiers.length) {
        list.innerHTML = '<p class="empty">Aucun courtier dans cette catégorie</p>';
        return;
      }

      list.innerHTML = `<table>
        <thead><tr><th>Courtier</th><th>Email</th><th>Téléphone</th><th>Statut</th><th>Soumis le</th><th>Action</th></tr></thead>
        <tbody>${courtiers.map(c => `
          <tr>
            <td><strong>${c.prenom} ${c.nom}</strong></td>
            <td>${c.email}</td>
            <td>${c.telephone || '—'}</td>
            <td>${pillStatut(c.statut_verification || 'non_soumis')}</td>
            <td>${fmtDate(c.date_soumission)}</td>
            <td>
              ${c.statut_verification && c.statut_verification !== 'non_soumis'
                ? `<button class="btn-sm btn-review" onclick="ouvrirModal('${c.id}')">Examiner</button>`
                : '<span style="color:var(--muted);font-size:12px">Pas de docs</span>'}
            </td>
          </tr>`).join('')}</tbody>
      </table>`;
    } catch (e) {
      list.innerHTML = `<p class="loading">Erreur : ${e.message}</p>`;
    }
  };

  chargerCourtiers();
}

// ── ══════════════════════════════════════════════════════════════════════════
//    AVIS PAGE
// ═════════════════════════════════════════════════════════════════════════════
if (document.getElementById('avis-list')) {
  requireAuth();
  document.getElementById('logout-link')?.addEventListener('click', (e) => { e.preventDefault(); logout(); });

  async function chargerAvis() {
    const statut = document.getElementById('filter-avis-statut').value;
    const list = document.getElementById('avis-list');
    list.innerHTML = '<p class="loading">Chargement…</p>';

    try {
      const data = await api('GET', `/api/admin/avis?statut=${statut}`);
      if (!data.length) { list.innerHTML = '<p class="empty">Aucun avis dans cette catégorie</p>'; return; }

      list.innerHTML = data.map(a => `
        <div class="avis-card">
          <div class="avis-header">
            <div class="avis-meta">
              <div class="avis-auteur">${a.auteur_prenom || 'Anonyme'}</div>
              <div class="avis-courtier">Pour ${a.courtier_prenom || ''} ${a.courtier_nom || ''}</div>
            </div>
            <div class="avis-date">${fmtDate(a.createdAt)}</div>
          </div>
          <div class="stars">${stars(a.note_globale)}</div>
          <div class="avis-commentaire">${a.commentaire || '<em style="color:var(--muted)">Sans commentaire</em>'}</div>
          <div class="avis-actions">
            ${a.statut !== 'publie' ? `<button class="btn-sm btn-approve" onclick="modererAvis('${a.id}','publie')">Publier</button>` : ''}
            ${a.statut !== 'supprime' ? `<button class="btn-sm btn-reject" onclick="modererAvis('${a.id}','supprime')">Supprimer</button>` : ''}
            ${pillStatut(a.statut)}
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<p class="loading">Erreur : ${e.message}</p>`;
    }
  }

  window.modererAvis = async function(id, statut) {
    try {
      await api('PATCH', `/api/admin/avis/${id}`, { statut });
      toast(statut === 'publie' ? 'Avis publié' : 'Avis supprimé');
      chargerAvis();
    } catch (e) { toast(e.message, 'error'); }
  };

  document.getElementById('filter-avis-statut').addEventListener('change', chargerAvis);
  chargerAvis();
}
