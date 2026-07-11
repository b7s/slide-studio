<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class Template extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'filename',
        'title',
        'html',
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
}
