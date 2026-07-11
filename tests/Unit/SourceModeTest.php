<?php

use App\Enums\Slide\SourceMode;

test('source mode default is deck', function () {
    expect(SourceMode::default())->toBe(SourceMode::Deck);
});

test('source mode has deck and template cases', function () {
    expect(SourceMode::cases())->toBe([SourceMode::Deck, SourceMode::Template])
        ->and(SourceMode::Deck->value)->toBe('deck')
        ->and(SourceMode::Template->value)->toBe('template');
});
