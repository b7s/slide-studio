<?php

namespace App\Data\Asset;

use Illuminate\Http\UploadedFile;

final readonly class StoreAssetData
{
    public function __construct(
        public UploadedFile $file,
        public ?int $presentationId,
        public ?string $originalName = null,
    ) {}
}
