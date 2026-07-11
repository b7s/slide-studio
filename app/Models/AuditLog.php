<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

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
