<?php

namespace App\Data\Asset;

final readonly class ListAssetsData
{
    public function __construct(
        public ?int $presentationId,
        public string $sort,
        public string $dir,
        public ?string $search,
    ) {}
}
