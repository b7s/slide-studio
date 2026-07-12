<?php

use App\Exceptions\ProblemJsonException;
use App\Http\Middleware\AssignRequestId;
use App\Http\Middleware\HandleInertiaRequests;
use App\Providers\FortifyServiceProvider;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withProviders([
        FortifyServiceProvider::class,
    ])
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);

        $middleware->api(append: [
            AssignRequestId::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*'),
        );

        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = 500;
            $title = __('messages.errors.internal_error');
            $detail = __('messages.errors.unexpected_detail');
            $type = 'about:blank';
            $extensions = [];

            if ($e instanceof ValidationException) {
                $status = 422;
                $title = __('messages.errors.unprocessable');
                $detail = __('messages.errors.validation_detail');
                $extensions['errors'] = $e->errors();
            } elseif ($e instanceof ProblemJsonException) {
                $status = $e->status;
                $title = $e->title;
                $detail = $e->detail;
                $type = $e->type ?? 'about:blank';
                $extensions = $e->extensions;
            } elseif ($e instanceof NotFoundHttpException) {
                $status = 404;
                $title = __('messages.errors.not_found');
                $detail = __('messages.errors.not_found_detail');
            } elseif ($e instanceof AuthenticationException) {
                $status = 401;
                $title = __('messages.errors.unauthorized');
                $detail = __('messages.errors.unauthorized_detail');
            } elseif ($e instanceof AccessDeniedHttpException) {
                $status = 403;
                $title = __('messages.errors.forbidden');
                $detail = __('messages.errors.forbidden_detail');
            } elseif (method_exists($e, 'getStatusCode')) {
                $status = (int) $e->getStatusCode();
                $title = (string) $e->getMessage();
            }

            $body = [
                'type' => $type,
                'title' => $title,
                'status' => $status,
                'detail' => $detail,
                'instance' => $request->header('X-Request-ID'),
            ];

            if ($extensions !== []) {
                $body = array_merge($body, $extensions);
            }

            return response()->json($body, $status);
        });
    })->create();
