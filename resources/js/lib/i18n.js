// Client-side translation helper mirroring Laravel's __().
// Translations are seeded from the server via Inertia shared props
// (see app/Http/Middleware/HandleInertiaRequests.php) so the same
// lang/pt_BR keys power both backend and frontend text. No user-facing
// string should be hardcoded in JSX — resolve it through __().

let translations = {};

export function setTranslations(map) {
  translations = map && typeof map === "object" ? map : {};
}

export function __(key, replace) {
  let str = Object.prototype.hasOwnProperty.call(translations, key)
    ? translations[key]
    : key;

  if (replace && typeof replace === "object") {
    for (const [token, value] of Object.entries(replace)) {
      str = str.split(`:${token}`).join(String(value));
    }
  }

  return str;
}

export default __;
