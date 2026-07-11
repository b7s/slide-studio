// Client-side route resolver. URLs come from the server via the Inertia
// shared `routes` prop (see app/Http/Middleware/HandleInertiaRequests.php),
// which builds them from Laravel named routes — so no endpoint path is ever
// hardcoded in JS. Slide routes carry a placeholder token that we swap for
// the encoded filename here.

let routes = {};

export function setRoutes(map) {
  routes = map && typeof map === "object" ? map : {};
}

export function route(name, params) {
  let url = Object.prototype.hasOwnProperty.call(routes, name) ? routes[name] : name;

  if (params && routes.slideToken) {
    if (params.slide !== undefined) {
      url = url.split(routes.slideToken).join(encodeURIComponent(params.slide));
    }
  }

  if (params && params.query && typeof params.query === "object") {
    const qs = new URLSearchParams(params.query).toString();
    if (qs) url += (url.includes("?") ? "&" : "?") + qs;
  }

  return url;
}

export default route;
