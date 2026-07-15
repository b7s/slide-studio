<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $asset_id
 * @property int $presentation_id
 * @property Carbon|null $last_used_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class AssetPresentation extends Pivot
{
    protected $table = 'asset_presentation';

    protected $fillable = [
        'asset_id',
        'presentation_id',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    /** @return BelongsTo<Asset, static> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    /** @return BelongsTo<Presentation, static> */
    public function presentation(): BelongsTo
    {
        return $this->belongsTo(Presentation::class);
    }
}
