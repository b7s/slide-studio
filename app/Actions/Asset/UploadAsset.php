<?php

namespace App\Actions\Asset;

use App\Data\Asset\StoreAssetData;
use App\Models\Asset;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class UploadAsset
{
    public function __invoke(StoreAssetData $data): Asset
    {
        return DB::transaction(function () use ($data): Asset {
            $file = $data->file;
            $extension = (string) pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION);
            if ($extension === '') {
                $extension = (string) $file->getClientOriginalExtension();
            }
            if ($extension === '') {
                $extension = 'jpg';
            }
            $name = Str::uuid7()->toString().'.'.$extension;

            $path = $file->storeAs('media', $name, ['disk' => 'public']);

            /** @var Asset $asset */
            $asset = Asset::query()->create([
                'user_id' => (int) auth()->id(),
                'path' => $path,
                'mime' => $file->getClientMimeType(),
            ]);

            if ($data->presentationId !== null) {
                $asset->presentations()->attach($data->presentationId, ['last_used_at' => now()]);
                $asset->forceFill(['last_used_at' => now()])->save();
            }

            Audit::record('asset.uploaded', $asset, [
                'path' => $path,
                'mime' => $file->getClientMimeType(),
                'presentation_id' => $data->presentationId,
            ]);

            return $asset->load('presentations');
        });
    }
}
