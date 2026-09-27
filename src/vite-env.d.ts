/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Measurement ID Google Analytics 4 (ex. G-XXXXXXXXXX).
   * Absent ou vide => gtag.js n'est pas chargé du tout.
   */
  readonly VITE_GA_MEASUREMENT_ID?: string;
}