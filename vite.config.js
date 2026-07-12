import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';

// Dev-server URL strategy for Valet-linux-plus + the local `*.test` resolver
// (`slide-studio.test` resolves to 127.0.0.1 via Dnsmasq). Vite defaults to
// printing its dev URL as `http://[::]:8124/...` (bracket-quad IPv6) which
// browsers cannot resolve when the page is loaded via the `.test` TLD —
// they try DNS for `[::]`, hit ERR_ADDRESS_INVALID, and the dev server
// effectively goes dark.
//
// Pin everything so URLs the browser sees match what it can actually
// reach: bind on all interfaces, fixed port, explicit origin pointing back
// at the user's access hostname, and open CORS in case the browser ever
// issues a cross-origin request during HMR.
const VITE_DEV_HOST = process.env.VITE_DEV_HOST ?? '0.0.0.0';
const VITE_DEV_PORT = Number(process.env.VITE_DEV_PORT ?? 8124);
// `VITE_DEV_ORIGIN` is the URL the BROWSER addresses the dev server by —
// when the user loads the page via `https://slide-studio.test`, this must
// be `http://slide-studio.test:8124` (the dev server is on a different
// origin from the nginx-served PHP page; CORS allows the cross-origin
// ESM/HMR requests). For pure-localhost access it falls back to
// `http://localhost:8124`.
const VITE_DEV_ORIGIN =
    process.env.VITE_DEV_ORIGIN ?? `http://${process.env.VITE_DEV_ORIGIN_HOST ?? 'localhost'}:${VITE_DEV_PORT}`;

export default defineConfig(({ mode }) => {
    // Surface dev DSN tokens to the Laravel plugin so the @vite/... helper
    // uses them when rendering server-side URLs (e.g. queued mail).
    loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            laravel({
                input: ['resources/css/app.css', 'resources/js/app.jsx'],
                refresh: true,
                fonts: [
                    bunny('Instrument Sans', {
                        weights: [400, 500, 600],
                    }),
                ],
            }),
            react(),
            tailwindcss(),
        ],
        server: {
            host: VITE_DEV_HOST,
            port: VITE_DEV_PORT,
            strictPort: true,
            // `origin` tells Vite which URL the BROWSER uses to reach the dev
            // server. Without this Vite emits `[::]:8124` which fails DNS
            // under the *.test resolver.
            origin: VITE_DEV_ORIGIN,
            cors: {
                // The browser at `https://slide-studio.test` fetches
                // `http://slide-studio.test:8124/...` — that's a different
                // origin so we have to allow it explicitly. Mirror the
                // request's origin so any *.test we tune for works.
                origin: true,
                credentials: true,
            },
            watch: {
                ignored: ['**/storage/framework/views/**'],
            },
        },
    };
});
