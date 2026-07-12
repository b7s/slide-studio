<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int|null $user_id
 * @property int|null $team_id
 * @property string $title
 * @property string $slug
 * @property string $deck_path
 * @property string $template_path
 * @property array<string, mixed> $settings
 * @property int $position
 */
final class Presentation extends Model
{
    protected $fillable = [
        'user_id',
        'team_id',
        'title',
        'slug',
        'deck_path',
        'template_path',
        'settings',
        'position',
    ];

    protected $casts = [
        'settings' => 'array',
    ];

    /** @return BelongsTo<User, static> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Team, static> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
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

    /** @return BelongsToMany<User, static> */
    public function sharedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'presentation_user')
            ->using(PresentationUser::class)
            ->withPivot('role', 'shared_by', 'team_id')
            ->withTimestamps();
    }
}
