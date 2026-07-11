<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Presentation extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'slug',
        'deck_path',
        'template_path',
        'settings',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    /** @return BelongsTo<User, static> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Slide, static> */
    public function slides(): HasMany
    {
        return $this->hasMany(Slide::class)->orderBy('position');
    }

    /** @return HasMany<Template, static> */
    public function templates(): HasMany
    {
        return $this->hasMany(Template::class);
    }

    /** @return HasMany<Asset, static> */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class);
    }
}
