<?php

namespace App\Actions\Asset;

use App\Data\Asset\ListAssetsData;
use App\Models\Asset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

final class ListAssets
{
    /**
     * @return Collection<int, Asset>
     */
    public function __invoke(ListAssetsData $data): Collection
    {
        $query = Asset::query()->where('user_id', (int) auth()->id());

        if ($data->presentationId !== null) {
            $query->whereHas('presentations', static function (Builder $q) use ($data): void {
                $q->where('presentation_id', $data->presentationId);
            });
        }

        if ($data->search !== null && $data->search !== '') {
            $query->where('path', 'like', '%'.$data->search.'%');
        }

        $dir = $data->dir === 'asc' ? 'asc' : 'desc';

        if ($data->sort === 'uploaded') {
            $query->orderBy('created_at', $dir);
        } else {
            // Keep assets that have never been used (last_used_at NULL) last,
            // regardless of direction, then sort by the chosen direction.
            $query->orderByRaw('last_used_at IS NULL');
            $query->orderBy('last_used_at', $dir);
        }

        return $query->get();
    }
}
