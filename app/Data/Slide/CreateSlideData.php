<?php

namespace App\Data\Slide;

final readonly class CreateSlideData
{
    public function __construct(
        public int $presentationId,
        public ?string $title = null,
    ) {}
}
