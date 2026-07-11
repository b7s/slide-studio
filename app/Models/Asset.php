<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $presentation_id
 * @property string $path
 * @property string $mime
 * @property string $data
 */
final class Asset extends Model
{
    protected $fillable = [
        'presentation_id',
        'path',
        'mime',
        'data',
    ];

    /** @return BelongsTo<Presentation, static> */
    public function presentation(): BelongsTo
    {
        return $this->belongsTo(Presentation::class);
    }
}
