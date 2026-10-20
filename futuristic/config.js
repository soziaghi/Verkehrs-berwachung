// Google Maps JavaScript API key (Maps JavaScript API must be enabled).
// This key is meant to be public in client-side code; protect it via an
// HTTP-referrer restriction in the Google Cloud Console, not by hiding it.
const GOOGLE_MAPS_API_KEY = "AIzaSyADS0hFwWINAhlumYchHPia-xi9aYz-UV8";

// TomTom Traffic API Key — kostenlos registrieren unter https://developer.tomtom.com/
// (Account anlegen → "My Apps" → "Add API Key" → Produkt "Traffic API" aktivieren).
// Wie beim Google-Key: im TomTom-Dashboard per Domain-/Referrer-Einschränkung
// auf die eigene Adresse absichern, nicht durch Geheimhalten. Leer lassen
// ("") um die TomTom-Anbindung zu deaktivieren — sie wird dann automatisch
// übersprungen, ohne Fehler zu werfen.
//
// Vorübergehend deaktiviert: der Key hat keine Credits mehr (TomTom-API
// antwortet mit HTTP 403 "InsufficientFunds"). Sobald das Konto aufgeladen
// oder ein neuer Key vorhanden ist, hier wieder eintragen.
const TOMTOM_API_KEY = "";

