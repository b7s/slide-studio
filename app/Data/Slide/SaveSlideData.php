<?php

namespace App\Data\Slide;

final readonly class SaveSlideData
{
    public function __construct(
        public string $html,
        public ?string $revision,
        public bool $overwrite,
    ) {}
}
