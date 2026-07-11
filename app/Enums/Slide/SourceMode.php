<?php

namespace App\Enums\Slide;

enum SourceMode: string
{
    case Deck = 'deck';
    case Template = 'template';

    public static function default(): self
    {
        return self::Deck;
    }
}
