<?php

namespace App\Http\Resources;

use App\Models\Presentation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property-read Presentation $resource
 */
final class PresentationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'title' => $this->resource->title,
            'slug' => $this->resource->slug,
            'team_id' => $this->resource->team_id,
            'deck_path' => $this->resource->deck_path,
            'template_path' => $this->resource->template_path,
            'created_at' => $this->resource->created_at,
            'updated_at' => $this->resource->updated_at,
        ];
    }
}
