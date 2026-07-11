<?php

namespace App\Data\Generation;

final readonly class GenerationCompletedData
{
    public function __construct(
        public int $generationId,
        public int $presentationId,
        public int $slideCount,
    ) {}
}
