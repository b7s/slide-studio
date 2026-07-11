<?php

namespace App\Models;

use App\Data\Generation\GenerationCompletedData;
use App\Data\Generation\GenerationFailedData;
use App\Data\Generation\GenerationStartedData;
use App\Enums\Generation\GenerationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $presentation_id
 * @property int|null $user_id
 * @property string $prompt
 * @property string $provider
 * @property string $model
 * @property GenerationStatus $status
 * @property int $slide_count
 * @property string|null $error
 */
final class Generation extends Model
{
    protected $fillable = [
        'presentation_id',
        'user_id',
        'prompt',
        'provider',
        'model',
        'status',
        'slide_count',
        'error',
    ];

    protected $attributes = [
        'status' => GenerationStatus::Pending,
        'slide_count' => 0,
    ];

    protected $casts = [
        'status' => GenerationStatus::class,
        'slide_count' => 'integer',
    ];

    /** @return BelongsTo<Presentation, static> */
    public function presentation(): BelongsTo
    {
        return $this->belongsTo(Presentation::class);
    }

    /** @return BelongsTo<User, static> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Slide, static> */
    public function slides(): HasMany
    {
        return $this->hasMany(Slide::class, 'generation_id');
    }

    public function markProcessing(): GenerationStartedData
    {
        if ($this->status !== GenerationStatus::Pending) {
            throw new \RuntimeException('Generation can only start from pending status.');
        }

        $this->status = GenerationStatus::Processing;
        $this->save();

        return new GenerationStartedData(
            generationId: $this->id,
            presentationId: $this->presentation_id,
        );
    }

    public function markCompleted(int $slideCount): GenerationCompletedData
    {
        if ($this->status !== GenerationStatus::Processing) {
            throw new \RuntimeException('Generation can only complete from processing status.');
        }

        $this->status = GenerationStatus::Completed;
        $this->slide_count = $slideCount;
        $this->error = null;
        $this->save();

        return new GenerationCompletedData(
            generationId: $this->id,
            presentationId: $this->presentation_id,
            slideCount: $slideCount,
        );
    }

    public function markFailed(string $error): GenerationFailedData
    {
        $this->status = GenerationStatus::Failed;
        $this->error = $error;
        $this->save();

        return new GenerationFailedData(
            generationId: $this->id,
            presentationId: $this->presentation_id,
            error: $error,
        );
    }
}
