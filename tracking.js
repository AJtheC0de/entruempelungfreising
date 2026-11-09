window.dataLayer = window.dataLayer || [];

window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};

const consentStorageKey = "ef_tracking_consent_v1";
const googleTagId = "AW-17077598027";
const googleAnalyticsId = "G-BSF88WQTJE";
const defaultConsent = { analytics: false, ads: false };

// Add the full AW-ID/label destinations here once the Google Ads manager provides them.
const googleAdsConversionDestinations = {
  contact_form_success: "",
  phone_click: "",
  whatsapp_click: "",
};

const readStoredConsent = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(consentStorageKey));
    if (stored?.version !== 1) return null;
    return {
      analytics: stored.analytics === true,
      ads: stored.ads === true,
    };
  } catch {
    return null;
  }
};

let storedConsent = readStoredConsent();
let activeConsent = storedConsent || defaultConsent;
let googleTagLoaded = false;
let analyticsConfigured = false;
let adsConfigured = false;

window.gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
  wait_for_update: 500,
});

const loadGoogleTag = () => {
  if (googleTagLoaded || (!activeConsent.analytics && !activeConsent.ads)) return;
  googleTagLoaded = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${googleTagId}`;
  script.dataset.googleTag = "true";
  document.head.append(script);
};

const configureGoogleDestinations = () => {
  if (activeConsent.analytics && !analyticsConfigured) {
    analyticsConfigured = true;
    window.gtag("config", googleAnalyticsId);
  }

  if (activeConsent.ads && !adsConfigured) {
    adsConfigured = true;
    window.gtag("config", googleTagId);
  }
};

const applyConsent = (consent) => {
  activeConsent = {
    analytics: consent.analytics === true,
    ads: consent.ads === true,
  };

  window.gtag("consent", "update", {
    analytics_storage: activeConsent.analytics ? "granted" : "denied",
    ad_storage: activeConsent.ads ? "granted" : "denied",
    ad_user_data: activeConsent.ads ? "granted" : "denied",
    ad_personalization: activeConsent.ads ? "granted" : "denied",
  });

  configureGoogleDestinations();
  loadGoogleTag();
};

if (storedConsent) applyConsent(storedConsent);

window.trackWebsiteEvent = function trackWebsiteEvent(eventName, eventData = {}) {
  const eventParameters = {
    page_path: window.location.pathname,
    ...eventData,
  };

  if (activeConsent.analytics) {
    window.gtag("event", eventName, eventParameters);
  }

  const sendTo = googleAdsConversionDestinations[eventName];
  if (activeConsent.ads && sendTo) {
    window.gtag("event", "conversion", { send_to: sendTo });
  }
};

const createConsentInterface = () => {
  const banner = document.createElement("section");
  banner.className = "consent-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-labelledby", "consent-title");
  banner.setAttribute("aria-describedby", "consent-description");
  banner.hidden = true;
  banner.innerHTML = `
    <div class="consent-panel">
      <button type="button" class="consent-close" data-consent-close aria-label="Nur notwendige Cookies verwenden und Fenster schließen">×</button>
      <div class="consent-copy">
        <p class="eyebrow">Datenschutz-Einstellungen</p>
        <h2 id="consent-title">Ihre Privatsphäre, Ihre Wahl.</h2>
        <p id="consent-description">Wählen Sie „Alle akzeptieren“, „Nur notwendige“ oder Ihre persönliche Auswahl. Statistik und Marketing starten erst nach Ihrer Einwilligung. <a href="/impressum-datenschutz/">Mehr erfahren</a></p>
      </div>
      <div class="consent-options" aria-label="Optionale Dienste">
        <div class="consent-option is-required">
          <span><strong>Notwendig</strong><small>Immer aktiv</small></span>
          <span class="consent-required" aria-hidden="true">✓</span>
        </div>
        <label class="consent-option">
          <span><strong>Statistik</strong><small>Google Analytics</small></span>
          <input type="checkbox" data-consent-analytics />
        </label>
        <label class="consent-option">
          <span><strong>Marketing</strong><small>Google Ads</small></span>
          <input type="checkbox" data-consent-ads />
        </label>
      </div>
      <div class="consent-actions">
        <button type="button" class="consent-button consent-accept" data-consent-accept>Alle akzeptieren</button>
        <button type="button" class="consent-button consent-reject" data-consent-reject>Nur notwendige</button>
        <button type="button" class="consent-button consent-save" data-consent-save>Auswahl speichern</button>
      </div>
    </div>`;

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "consent-settings-button";
  settingsButton.textContent = "Cookie-Einstellungen";
  settingsButton.setAttribute("aria-label", "Datenschutz- und Cookie-Einstellungen öffnen");

  document.body.append(banner, settingsButton);

  const analyticsInput = banner.querySelector("[data-consent-analytics]");
  const adsInput = banner.querySelector("[data-consent-ads]");

  const openBanner = () => {
    analyticsInput.checked = activeConsent.analytics;
    adsInput.checked = activeConsent.ads;
    banner.hidden = false;
    settingsButton.hidden = true;
  };

  const closeBanner = () => {
    banner.hidden = true;
    settingsButton.hidden = false;
  };

  const saveConsent = (consent) => {
    const shouldReload = googleTagLoaded && !consent.analytics && !consent.ads;
    storedConsent = consent;

    try {
      localStorage.setItem(consentStorageKey, JSON.stringify({ version: 1, ...consent }));
    } catch {
      // Consent still applies for the current page if storage is unavailable.
    }

    applyConsent(consent);
    closeBanner();

    if (shouldReload) window.location.reload();
  };

  banner.querySelector("[data-consent-reject]").addEventListener("click", () => {
    saveConsent({ analytics: false, ads: false });
  });

  banner.querySelector("[data-consent-close]").addEventListener("click", () => {
    saveConsent({ analytics: false, ads: false });
  });

  banner.querySelector("[data-consent-save]").addEventListener("click", () => {
    saveConsent({ analytics: analyticsInput.checked, ads: adsInput.checked });
  });

  banner.querySelector("[data-consent-accept]").addEventListener("click", () => {
    saveConsent({ analytics: true, ads: true });
  });

  settingsButton.addEventListener("click", openBanner);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || banner.hidden) return;
    event.preventDefault();
    saveConsent({ analytics: false, ads: false });
  });

  if (storedConsent) {
    closeBanner();
  } else {
    openBanner();
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", createConsentInterface, { once: true });
} else {
  createConsentInterface();
}
