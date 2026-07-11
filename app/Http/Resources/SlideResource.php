<?php

namespace App\Http\Resources;

use App\Enums\Slide\SourceMode;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property int $id
 * @property string $filename
 * @property string|null $title
 * @property int $position
 * @property SourceMode $source_mode
 * @property string|null $html
 * @property string|null $revision
 */
final class SlideResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'file' => $this->filename,
            'title' => $this->title,
            'number' => (string) $this->position,
            'source_mode' => $this->source_mode->value,
            'html' => $this->html,
            'revision' => $this->revision,
        ];
    }
}
