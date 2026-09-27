/**
 * Intégration Google Analytics 4 (gtag.js) pour WELCOME ML.
 *
 * Pourquoi ici et pas dans index.html :
 *  - le site est une SPA Vite entièrement client-side, sans routeur ni SSR. Toute
 *    la logique de chargement tient donc dans un module TS appelé depuis main.tsx,
 *    ce qui permet de ne rien injecter tant qu'aucun Measurement ID n'est
 *    configuré (pas de requête vers Google inutile, pas de script cassé).
 *  - le Measurement ID est lu via `import.meta.env` (convention Vite : préfixe
 *    `VITE_`), donc variable documentée dans .env.example.
 *
 * Comportement :
 *  - variable absente, vide ou invalide -> no-op complet (aucun script, aucune
 *    erreur, aucun warning en production) ;
 *  - appel idempotent (garde locale + id de script) : même si initAnalytics()
 *    est appelé plusieurs fois (React StrictMode, hot reload), gtag.js n'est
 *    chargé qu'une seule fois et une seule config est envoyée ;
 *  - script injecté en `async` dans <head> : il ne bloque jamais le rendu.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = 'ga4-loader';
const SCRIPT_SRC = 'https://www.googletagmanager.com/gtag/js';

/**
 * Format d'un Measurement ID GA4 : "G-" suivi de 6 à 20 caractères
 * alphanumériques majuscules. Volontairement strict pour rejeter les valeurs
 * manifestement fausses ("VOTRE_ID", "1234", ...) plutôt que d'envoyer des
 * données à un identifiant inexistant.
 */
const MEASUREMENT_ID_PATTERN = /^G-([A-Z0-9]{6,20})$/;

/**
 * Suffixe composé d'un seul caractère répété ("G-XXXXXXXXXX", "G-0000000000") :
 * c'est la forme des identifiants d'exemple copiés depuis une documentation,
 * jamais un vrai identifiant (probabilité ~1/36^10 pour un ID généré aléatoirement).
 */
const PLACEHOLDER_SUFFIX = /^(.)\1+$/;

/** Évite une double initialisation (appels multiples, hot reload en dev). */
let initialized = false;

/** Measurement ID configuré, ou `null` si l'intégration doit rester inactive. */
function readMeasurementId(): string | null {
  const raw: unknown = import.meta.env.VITE_GA_MEASUREMENT_ID;
  if (typeof raw !== 'string') return null;

  const id = raw.trim();
  if (!id) return null;

  const match = MEASUREMENT_ID_PATTERN.exec(id);
  if (!match || PLACEHOLDER_SUFFIX.test(match[1])) {
    if (import.meta.env.DEV) {
      console.warn(
        `[analytics] VITE_GA_MEASUREMENT_ID ignorée : « ${id} » n'est pas un Measurement ID GA4 valide (format attendu : G- suivi de 6 à 20 caractères alphanumériques). Google Analytics reste désactivé.`
      );
    }
    return null;
  }

  return id;
}

function injectGtagScript(measurementId: string): void {
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `${SCRIPT_SRC}?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

/**
 * Charge gtag.js et configure la propriété GA4.
 * Sans effet si aucun Measurement ID valide n'est défini dans l'environnement.
 * L'envoi de la vue de page est laissé à gtag lui-même (`send_page_view` par
 * défaut) : le site n'a qu'une seule page, donc une seule vue par chargement.
 */
export function initAnalytics(): void {
  const measurementId = readMeasurementId();
  if (!measurementId) return;
  if (initialized) return;

  initialized = true;

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]): void => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: true });

  injectGtagScript(measurementId);
}

/**
 * Envoie un événement personnalisé à GA4.
 *
 * No-op tant que `initAnalytics()` n'a pas été appelé avec un Measurement ID
 * valide, donc utilisable sans garde supplémentaire depuis l'UI.
 *
 * Exemple : `trackEvent('universe_change', { universe_id: 'cosmos' })`
 */
export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!initialized) return;
  window.gtag?.('event', name, params);
}
