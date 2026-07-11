<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    /**
     * Placeholder tokens swapped client-side for dynamic route segments. Keeps
     * URL construction on the server (named routes) while letting the client
     * inject dynamic segments (slide filename, presentation slug, generation id)
     * without hardcoding any path in JS.
     */
    private const string SLIDE_TOKEN = '__FILE__';

    private const string PRESENTATION_TOKEN = '__PRESENTATION__';

    private const string GENERATION_TOKEN = '__GENERATION__';

    private const string USER_TOKEN = '__USER__';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'locale' => app()->getLocale(),
            'translations' => $this->translations(app()->getLocale()),
            'routes' => $this->routes(),
            'auth' => [
                'user' => $request->user(),
            ],
        ]);
    }

    /**
     * Named-route URLs exposed to the client so no endpoint is hardcoded in
     * JS. Slide routes carry a placeholder token (see SLIDE_TOKEN) that the
     * client replaces with the encoded filename.
     *
     * @return array<string, string>
     */
    private function routes(): array
    {
        return [
            'config' => route('api.v1.config', absolute: false),
            'slidesIndex' => route('api.v1.slides.index', absolute: false),
            'slidesHtml' => route('api.v1.slides.html', absolute: false),
            'slideSave' => route('api.v1.slides.save', ['slide' => self::SLIDE_TOKEN], false),
            'slideDuplicate' => route('api.v1.slides.duplicate', ['slide' => self::SLIDE_TOKEN], false),
            'reorder' => route('api.v1.reorder', absolute: false),
            'generate' => route('api.v1.generate', ['presentation' => self::PRESENTATION_TOKEN], false),
            'generationShow' => route('api.v1.generation.show', ['generation' => self::GENERATION_TOKEN], false),
            'sharesIndex' => route('api.v1.shares.index', ['presentation' => self::PRESENTATION_TOKEN], false),
            'sharesUpdate' => route('api.v1.shares.update', ['presentation' => self::PRESENTATION_TOKEN, 'user' => self::USER_TOKEN], false),
            'sharesDestroy' => route('api.v1.shares.destroy', ['presentation' => self::PRESENTATION_TOKEN, 'user' => self::USER_TOKEN], false),
            'usersSearch' => route('api.v1.users.search', absolute: false),
            'slideToken' => self::SLIDE_TOKEN,
            'presentationToken' => self::PRESENTATION_TOKEN,
            'generationToken' => self::GENERATION_TOKEN,
            'userToken' => self::USER_TOKEN,
        ];
    }

    /**
     * Flatten lang/{locale}/messages.php into dot-keyed strings, merged with
     * the English fallback so every key is always present on the client.
     *
     * @return array<string, string>
     */
    private function translations(string $locale): array
    {
        $load = static function (string $code): array {
            $path = lang_path("{$code}/messages.php");
            if (! is_file($path)) {
                return [];
            }

            /** @var array<string, mixed> $messages */
            $messages = require $path;
            $flat = [];

            $dot = static function (array $items, string $prefix = '') use (&$dot, &$flat): void {
                foreach ($items as $key => $value) {
                    $next = $prefix === '' ? (string) $key : "{$prefix}.{$key}";
                    if (is_array($value)) {
                        $dot($value, $next);
                    } else {
                        $flat[$next] = (string) $value;
                    }
                }
            };
            $dot($messages);

            return $flat;
        };

        /** @var array<string, string> $merged */
        $merged = array_merge($load('en'), $load($locale));

        return $merged;
    }
}
