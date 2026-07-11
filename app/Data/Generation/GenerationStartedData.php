<?php

namespace App\Data\Generation;

final readonly class GenerationStartedData
{
    public function __construct(
        public int $generationId,
        public int $presentationId,
    ) {}
}
