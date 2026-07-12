<?php

namespace App\Models;

use App\Enums\Sharing\PresentationRole;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property PresentationRole $role
 * @property int $presentation_id
 * @property int $user_id
 * @property int|null $team_id
 * @property int|null $shared_by
 */
final class PresentationUser extends Pivot
{
    protected $table = 'presentation_user';

    protected $fillable = [
        'presentation_id',
        'user_id',
        'team_id',
        'shared_by',
        'role',
    ];

    protected $casts = [
        'role' => PresentationRole::class,
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

    /** @return BelongsTo<Team, static> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, static> */
    public function sharedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shared_by');
    }
}
