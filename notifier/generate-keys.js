/* Ejecutar UNA sola vez para crear el "DNI" del sistema de avisos:
     cd notifier && npm install && npm run keys

   Te imprimirá dos claves:
   - VAPID_PUBLIC_KEY  → va en app.js (constante) y en los Secrets de GitHub
   - VAPID_PRIVATE_KEY → SOLO en los Secrets de GitHub (nunca en app.js)
*/
const webpush = require('web-push');
const keys = webpush.generateVAPIDKeys();
console.log('\n=== Claves VAPID (guárdalas, se generan una sola vez) ===\n');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('\nQué hacer con ellas: ver CLAUDE.md → "Puesta en marcha".');
