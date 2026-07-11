<?php

return [

    /*
    |--------------------------------------------------------------------------
    | AI Slide Generation
    |--------------------------------------------------------------------------
    |
    | Configuration for the AI generation context. The primary provider / model
    | are used to generate slide decks. When the primary provider is rate
    | limited or otherwise unavailable, the SDK automatically failover to the
    | configured fallback provider / model (only FailoverableExceptions trigger
    | a failover, ordinary errors do not).
    |
    */

    'generation' => [
        'provider' => env('AI_PROVIDER', 'openai'),
        'model' => env('AI_MODEL', 'gpt-4o'),
        'fallback_provider' => env('AI_FALLBACK_PROVIDER', 'anthropic'),
        'fallback_model' => env('AI_FALLBACK_MODEL', 'claude-3-5-sonnet-latest'),
        'max_slides' => env('AI_MAX_SLIDES', 8),
    ],

];
