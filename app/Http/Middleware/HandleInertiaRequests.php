<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'locale' => app()->getLocale(),
            'translations' => $this->translations(app()->getLocale()),
            'auth' => [
                'user' => $request->user(),
            ],
        ]);
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
