<?php

namespace App\Data\Slide;

final readonly class ReorderSlidesData
{
    /**
     * @param  array<string, int>  $order
     */
    public function __construct(
        public int $presentationId,
        public array $order,
    ) {}
}
