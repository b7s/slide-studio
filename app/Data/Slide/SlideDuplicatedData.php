<?php

namespace App\Data\Slide;

final readonly class SlideDuplicatedData
{
    public function __construct(
        public int $slideId,
        public string $filename,
    ) {}
}
