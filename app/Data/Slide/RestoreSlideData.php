<?php

namespace App\Data\Slide;

final readonly class RestoreSlideData
{
    public function __construct(
        public int $presentationId,
        public string $filename,
        public string $title,
        public int $position,
        public string $html,
        public string $sourceMode,
        public ?string $revision = null,
    ) {}
}
