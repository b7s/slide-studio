<?php

namespace App\Data\Slide;

final readonly class SlideCopiedData
{
    public function __construct(
        public int $slideId,
        public string $filename,
    ) {}
}
