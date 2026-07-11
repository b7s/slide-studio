<?php

use App\Http\Controllers\Api\V1\ConfigController;
use App\Http\Controllers\Api\V1\GenerateController;
use App\Http\Controllers\Api\V1\SlideController;
use App\Models\Generation;
use App\Models\Presentation;
use App\Models\Slide;
use Illuminate\Support\Facades\Route;

Route::bind('slide', static fn (string $value): Slide => Slide::where('filename', $value)->firstOrFail());
Route::bind('presentation', static fn (string $value): Presentation => Presentation::where('slug', $value)->firstOrFail());
Route::bind('generation', static fn (int $value): Generation => Generation::query()->findOrFail($value));

Route::prefix('v1')->name('api.v1.')->group(function () {
    Route::get('config', [ConfigController::class, 'show'])->name('config');

    Route::get('slides', [SlideController::class, 'index'])->name('slides.index');
    Route::get('slides/html', [SlideController::class, 'htmlByFile'])->name('slides.html');
    Route::post('slides/{slide}', [SlideController::class, 'save'])->name('slides.save');
    Route::post('slides/{slide}/duplicate', [SlideController::class, 'duplicate'])->name('slides.duplicate');
    Route::post('reorder', [SlideController::class, 'reorder'])->name('reorder');

    Route::post('presentations/{presentation}/generate', [GenerateController::class, 'store'])->name('generate');
    Route::get('generations/{generation}', [GenerateController::class, 'show'])->name('generation.show');
});
