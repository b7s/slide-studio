<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

/**
 * @property int $id
 * @property string $event
 * @property string $subject_type
 * @property int $subject_id
 * @property string|null $actor_type
 * @property int|null $actor_id
 * @property array<string, mixed> $context
 * @property string|null $request_id
 */
final class AuditLog extends Model
{
    protected $fillable = [
        'event',
        'subject_type',
        'subject_id',
        'actor_type',
        'actor_id',
        'context',
        'request_id',
    ];

    protected $casts = [
        'context' => 'array',
    ];

    /** @return MorphTo<Model, static> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return MorphTo<Model, static> */
    public function actor(): MorphTo
    {
        return $this->morphTo();
    }
}
