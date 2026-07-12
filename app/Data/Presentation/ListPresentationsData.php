<?php

namespace App\Data\Presentation;

final readonly class ListPresentationsData
{
    public function __construct(
        public string $group,
        public ?int $teamId,
        public ?string $query,
        public string $sort,
        public string $dir,
        public int $page,
        public int $perPage,
    ) {}
}
