<?php

namespace App\Data\Generation;

final readonly class GenerationRequestedData
{
    public function __construct(
        public int $generationId,
        public int $presentationId,
        public string $prompt,
        public int $maxSlides,
    ) {}
}
