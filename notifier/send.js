'use strict';
/* Lo ejecuta GitHub Actions cada 15 min (ver .github/workflows/send-notifications.yml).
   Lee las suscripciones del repo, mira cuáles tocan y manda el push. */
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const SUBS_DIR = path.join(__dirname, '..', 'subscriptions');
const SENT_FILE = path.join(__dirname, 'sent.json');
const DAY = 86400000;

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'nobody@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// IDs ya enviados (para no repetir). Cada clave es "idDelAviso@momentoDeEnvio".
function loadSent() {
  try { return new Set(JSON.parse(fs.readFileSync(SENT_FILE, 'utf8'))); }
  catch { return new Set(); }
}

async function main() {
  if (!fs.existsSync(SUBS_DIR)) { console.log('No hay carpeta subscriptions/'); return; }
  const files = fs.readdirSync(SUBS_DIR).filter((f) => f.endsWith('.json'));
  if (!files.length) { console.log('No hay suscripciones registradas.'); return; }

  const sent = loadSent();
  const now = Date.now();
  let changed = false;

  for (const file of files) {
    const full = path.join(SUBS_DIR, file);
    let entry;
    try { entry = JSON.parse(fs.readFileSync(full, 'utf8')); } catch { continue; }
    const { subscription, schedule = [] } = entry;
    if (!subscription) continue;

    for (const item of schedule) {
      const key = `${item.id}@${item.sendAt}`;
      if (item.sendAt > now || sent.has(key)) continue;
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title: item.title, body: item.body, tag: item.id })
        );
        sent.add(key);
        changed = true;
        console.log('Enviado →', file, '·', item.title);
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          fs.unlinkSync(full);
          changed = true;
          console.log('Suscripción caducada, eliminada:', file);
          break;
        }
        console.error('Error al enviar:', err.statusCode, err.message);
      }
    }
  }

  // Limpia registros de envío de hace más de 30 días para que el fichero no crezca.
  const pruned = [...sent].filter((k) => {
    const at = Number(k.split('@')[1]);
    return Number.isNaN(at) || at > now - 30 * DAY;
  });
  if (changed || pruned.length !== sent.size) {
    fs.writeFileSync(SENT_FILE, JSON.stringify(pruned, null, 2));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
