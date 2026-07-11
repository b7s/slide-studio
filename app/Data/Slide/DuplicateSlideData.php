<?php

namespace App\Data\Slide;

final readonly class DuplicateSlideData
{
    public function __construct(
        public string $filename,
        public ?string $title,
    ) {}
}
