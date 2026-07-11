<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="theme-color" content="#e9e9e8">
        <title>{{ config('app.name', 'Slide Studio') }}</title>
        @viteReactRefresh
        @vite(['resources/js/app.jsx'])
    </head>
    <body class="h-full">
        @inertia
    </body>
</html>
