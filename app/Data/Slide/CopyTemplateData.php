<?php

namespace App\Data\Slide;

final readonly class CopyTemplateData
{
    public function __construct(
        public int $presentationId,
        public ?string $title,
    ) {}
}
