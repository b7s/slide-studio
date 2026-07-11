<?php

namespace App\Enums\Generation;

enum GenerationStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';

    public static function default(): self
    {
        return self::Pending;
    }
}
