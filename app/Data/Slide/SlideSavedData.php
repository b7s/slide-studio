<?php

namespace App\Data\Slide;

final readonly class SlideSavedData
{
    public function __construct(
        public int $slideId,
        public string $filename,
        public string $revision,
        public string $html,
    ) {}
}
