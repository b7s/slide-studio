<?php

namespace App\Models;

use App\Data\Slide\SlideSavedData;
use App\Enums\Slide\SourceMode;
use App\Exceptions\ProblemJsonException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $presentation_id
 * @property int $position
 * @property string $filename
 * @property string|null $title
 * @property string|null $html
 * @property SourceMode $source_mode
 * @property string|null $revision
 */
final class Slide extends Model
{
    protected $fillable = [
        'presentation_id',
        'position',
        'filename',
        'title',
        'html',
        'source_mode',
        'revision',
    ];

    protected $attributes = [
        'source_mode' => SourceMode::Deck,
    ];

    protected $casts = [
        'position' => 'integer',
        'source_mode' => SourceMode::class,
    ];

    /** @return BelongsTo<Presentation, static> */
    public function presentation(): BelongsTo
    {
        return $this->belongsTo(Presentation::class);
    }

    public function saveContent(string $html, ?string $revision, bool $overwrite): SlideSavedData
    {
        if (! $overwrite && $revision !== null && $this->revision !== null && $revision !== $this->revision) {
            throw new ProblemJsonException(
                title: __('messages.errors.conflict'),
                detail: __('messages.errors.conflict_detail'),
                status: 409,
            );
        }

        $this->html = $html;
        $this->revision = $revision ?? (string) Str::uuid7();
        $this->save();

        return new SlideSavedData(
            slideId: $this->id,
            filename: $this->filename,
            revision: (string) $this->revision,
            html: (string) $this->html,
        );
    }
}
