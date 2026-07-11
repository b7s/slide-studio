<?php

namespace App\Data\Generation;

final readonly class GenerationFailedData
{
    public function __construct(
        public int $generationId,
        public int $presentationId,
        public string $error,
    ) {}
}
