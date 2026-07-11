<?php

namespace App\Exceptions;

use RuntimeException;

final class ProblemJsonException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $extensions
     */
    public function __construct(
        public readonly string $title,
        public readonly string $detail,
        public readonly int $status = 422,
        public readonly ?string $type = null,
        public readonly array $extensions = [],
    ) {
        parent::__construct($detail, $status);
    }
}
