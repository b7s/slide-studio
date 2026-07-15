<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Presentation\ListAccessiblePresentations;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PresentationController extends Controller
{
    public function accessible(Request $request, ListAccessiblePresentations $action): JsonResponse
    {
        return response()->json([
            'presentations' => $action($request->user()),
        ]);
    }
}
