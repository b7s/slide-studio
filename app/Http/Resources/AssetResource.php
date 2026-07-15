<?php

namespace App\Http\Resources;

use App\Models\Asset;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Asset $resource
 */
final class AssetResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->resource->id,
            'path' => $this->resource->path,
            'url' => $this->resource->url,
            'mime' => $this->resource->mime,
            'last_used_at' => $this->resource->last_used_at === null ? null : $this->resource->last_used_at->toISOString(),
            'created_at' => $this->resource->created_at->toISOString(),
        ];
    }
}
