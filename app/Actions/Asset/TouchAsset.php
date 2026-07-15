<?php

namespace App\Actions\Asset;

use App\Models\Asset;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

final class TouchAsset
{
    public function __invoke(Asset $asset, int $presentationId): Asset
    {
        return DB::transaction(function () use ($asset, $presentationId): Asset {
            $asset->presentations()->syncWithoutDetaching([
                $presentationId => ['last_used_at' => now()],
            ]);
            $asset->forceFill(['last_used_at' => now()])->save();

            Audit::record('asset.touched', $asset, [
                'presentation_id' => $presentationId,
            ]);

            return $asset;
        });
    }
}
