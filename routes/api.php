<?php

use App\Http\Controllers\Api\V1\AssetController;
use App\Http\Controllers\Api\V1\ConfigController;
use App\Http\Controllers\Api\V1\GenerateController;
use App\Http\Controllers\Api\V1\PresentationController;
use App\Http\Controllers\Api\V1\PresentationLibraryController;
use App\Http\Controllers\Api\V1\SharingController;
use App\Http\Controllers\Api\V1\SlideController;
use App\Models\Asset;
use App\Models\Generation;
use App\Models\Presentation;
use App\Models\Slide;
use App\Models\User;
use Illuminate\Support\Facades\Route;

// Slides are identified by `filename`, which is only unique *within* a
// presentation (UniqueSlideFilename scopes by presentation_id). Resolve a slide
// by filename, optionally scoped to the presentation supplied via the
// `presentation_id` query param — otherwise fall back to the first global match
// (used by copy-to-deck, whose body `presentation_id` is the *target*
// presentation and must NOT scope the *source* template lookup).
Route::bind('slide', static function (string $value): Slide {
    $query = Slide::query()->where('filename', $value);
    $presentationId = (string) request()->query('presentation_id', '');
    if ($presentationId !== '') {
        $query->where('presentation_id', (int) $presentationId);
    }

    return $query->firstOrFail();
});
Route::bind('presentation', static fn (string $value): Presentation => Presentation::query()->where('slug', $value)->firstOrFail());
Route::bind('generation', static fn (int $value): Generation => Generation::query()->findOrFail($value));
Route::bind('user', static fn (int $value): User => User::query()->findOrFail($value));
Route::bind('asset', static fn (int $value): Asset => Asset::query()->findOrFail($value));

Route::prefix('v1')->name('api.v1.')->middleware('auth')->group(function () {
    Route::get('config', [ConfigController::class, 'show'])->name('config');

    Route::get('presentations', [PresentationController::class, 'accessible'])->name('presentations.accessible');
    Route::put('presentations/{presentation}', [PresentationController::class, 'rename'])->name('presentations.rename');

    Route::get('assets', [AssetController::class, 'index'])->name('assets.index');
    Route::post('assets', [AssetController::class, 'store'])->name('assets.store');
    Route::post('assets/{asset}/touch', [AssetController::class, 'touch'])->name('assets.touch');
    Route::delete('assets/{asset}', [AssetController::class, 'destroy'])->name('assets.destroy');

    Route::get('library/groups', [PresentationLibraryController::class, 'groups'])->name('library.groups');
    Route::post('library', [PresentationLibraryController::class, 'store'])->name('library.store');
    Route::get('library', [PresentationLibraryController::class, 'index'])->name('library.index');

    Route::get('slides', [SlideController::class, 'index'])->name('slides.index');
    Route::post('slides', [SlideController::class, 'create'])->name('slides.create');
    Route::post('slides/restore', [SlideController::class, 'restore'])->name('slides.restore');
    Route::delete('slides/{slide}', [SlideController::class, 'destroy'])->name('slides.destroy');
    Route::get('slides/html', [SlideController::class, 'htmlByFile'])->name('slides.html');
    Route::post('slides/{slide}', [SlideController::class, 'save'])->name('slides.save');
    Route::post('slides/{slide}/duplicate', [SlideController::class, 'duplicate'])->name('slides.duplicate');
    Route::post('slides/{slide}/copy-to-deck', [SlideController::class, 'copyToDeck'])->name('slides.copyToDeck');
    Route::post('slides/{slide}/rename', [SlideController::class, 'rename'])->name('slides.rename');
    Route::post('reorder', [SlideController::class, 'reorder'])->name('reorder');

    Route::post('presentations/{presentation}/generate', [GenerateController::class, 'store'])->name('generate');
    Route::get('generations/{generation}', [GenerateController::class, 'show'])->name('generation.show');

    Route::get('presentations/{presentation}/shares', [SharingController::class, 'index'])->name('shares.index');
    Route::put('presentations/{presentation}/shares/{user}', [SharingController::class, 'update'])->name('shares.update');
    Route::delete('presentations/{presentation}/shares/{user}', [SharingController::class, 'destroy'])->name('shares.destroy');
    Route::get('users/search', [SharingController::class, 'search'])->name('users.search');
});
