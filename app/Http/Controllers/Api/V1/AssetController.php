<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Asset\ListAssets;
use App\Actions\Asset\TouchAsset;
use App\Actions\Asset\UploadAsset;
use App\Http\Controllers\Controller;
use App\Http\Requests\Asset\ListAssetsRequest;
use App\Http\Requests\Asset\StoreAssetRequest;
use App\Http\Resources\AssetResource;
use App\Models\Asset;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AssetController extends Controller
{
    use AuthorizesRequests;

    public function index(ListAssetsRequest $request, ListAssets $action): JsonResponse
    {
        $assets = $action($request->payload());

        return AssetResource::collection($assets)->response();
    }

    public function store(StoreAssetRequest $request, UploadAsset $action): JsonResponse
    {
        $asset = $action($request->payload());

        return (new AssetResource($asset))
            ->response()
            ->setStatusCode(201);
    }

    public function touch(Request $request, Asset $asset, TouchAsset $action): JsonResponse
    {
        $this->authorize('touch', $asset);

        $presentationId = (int) $request->input('presentation_id');
        $asset = $action($asset, $presentationId);

        return (new AssetResource($asset))->response();
    }

    public function destroy(Request $request, Asset $asset): JsonResponse
    {
        $this->authorize('delete', $asset);

        $asset->delete();

        return response()->json(['ok' => true]);
    }
}
