<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ConfigController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'mode' => 'local',
            'deckRoot' => '/apresentacao',
            'templateRoot' => '/modelos',
            'deckAvailable' => true,
            'templatesAvailable' => true,
            'previewOrigin' => '',
        ]);
    }
}
