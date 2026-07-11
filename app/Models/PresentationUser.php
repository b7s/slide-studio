<?php

namespace App\Models;

use App\Enums\Sharing\PresentationRole;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property PresentationRole $role
 * @property int $presentation_id
 * @property int $user_id
 * @property int|null $shared_by
 */
final class PresentationUser extends Pivot
{
    protected $table = 'presentation_user';

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

    /** @return BelongsTo<User, static> */
    public function sharedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'shared_by');
    }
}
