<?php

namespace App\Data\Generation;

final readonly class GenerateSlidesData
{
    public function __construct(
        public string $prompt,
        public int $maxSlides,
    ) {}
}
