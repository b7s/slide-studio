<?php

use App\Http\Controllers\Api\V1\ConfigController;
use App\Http\Controllers\Api\V1\SlideController;
use App\Models\Slide;
use Illuminate\Support\Facades\Route;

Route::bind('slide', static fn (string $value): Slide => Slide::where('filename', $value)->firstOrFail());

Route::prefix('v1')->group(function () {
    Route::get('config', [ConfigController::class, 'show']);

    Route::get('slides', [SlideController::class, 'index']);
    Route::get('slides/html', [SlideController::class, 'htmlByFile']);
    Route::post('slides/{slide}', [SlideController::class, 'save']);
    Route::post('slides/{slide}/duplicate', [SlideController::class, 'duplicate']);
    Route::post('reorder', [SlideController::class, 'reorder']);
});
