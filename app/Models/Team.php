<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $user_id
 * @property string $name
 * @property string $slug
 * @property bool $personal
 */
final class Team extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'slug',
        'personal',
    ];

    protected $casts = [
        'personal' => 'boolean',
    ];

    protected static function booted(): void
    {
        self::creating(function (Team $team): void {
            if (! $team->slug) {
                $team->slug = Str::slug($team->name).'-'.Str::random(4);
            }
        });
    }

    /** @return BelongsTo<User, static> */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** @return BelongsToMany<User, static> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_user')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** @return HasMany<Presentation, static> */
    public function presentations(): HasMany
    {
        return $this->hasMany(Presentation::class);
    }
}
