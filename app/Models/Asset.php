<?php

namespace App\Models;

use Database\Factories\AssetFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $user_id
 * @property string $path
 * @property string|null $mime
 * @property string|null $data
 * @property string $url
 * @property Carbon|null $last_used_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class Asset extends Model
{
    /** @use HasFactory<AssetFactory> */
    use HasFactory;

    protected $fillable = [
        'user_id',
        'path',
        'mime',
        'data',
        'last_used_at',
    ];

    protected $appends = [
        'url',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    /** @return BelongsTo<User, static> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsToMany<Presentation, static> */
    public function presentations(): BelongsToMany
    {
        return $this->belongsToMany(Presentation::class)
            ->using(AssetPresentation::class)
            ->withPivot('last_used_at')
            ->withTimestamps();
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
