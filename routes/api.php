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

Route::bind('slide', static fn (string $value): Slide => Slide::query()->where('filename', $value)->firstOrFail());
Route::bind('presentation', static fn (string $value): Presentation => Presentation::query()->where('slug', $value)->firstOrFail());
Route::bind('generation', static fn (int $value): Generation => Generation::query()->findOrFail($value));
Route::bind('user', static fn (int $value): User => User::query()->findOrFail($value));
Route::bind('asset', static fn (int $value): Asset => Asset::query()->findOrFail($value));

Route::prefix('v1')->name('api.v1.')->middleware('auth')->group(function () {
    Route::get('config', [ConfigController::class, 'show'])->name('config');

    Route::get('presentations', [PresentationController::class, 'accessible'])->name('presentations.accessible');

    Route::get('assets', [AssetController::class, 'index'])->name('assets.index');
    Route::post('assets', [AssetController::class, 'store'])->name('assets.store');
    Route::post('assets/{asset}/touch', [AssetController::class, 'touch'])->name('assets.touch');
    Route::delete('assets/{asset}', [AssetController::class, 'destroy'])->name('assets.destroy');

    Route::get('library/groups', [PresentationLibraryController::class, 'groups'])->name('library.groups');
    Route::post('library', [PresentationLibraryController::class, 'store'])->name('library.store');
    Route::get('library', [PresentationLibraryController::class, 'index'])->name('library.index');

    Route::get('slides', [SlideController::class, 'index'])->name('slides.index');
    Route::get('slides/html', [SlideController::class, 'htmlByFile'])->name('slides.html');
    Route::post('slides/{slide}', [SlideController::class, 'save'])->name('slides.save');
    Route::post('slides/{slide}/duplicate', [SlideController::class, 'duplicate'])->name('slides.duplicate');
    Route::post('slides/{slide}/copy-to-deck', [SlideController::class, 'copyToDeck'])->name('slides.copyToDeck');
    Route::post('reorder', [SlideController::class, 'reorder'])->name('reorder');

    Route::post('presentations/{presentation}/generate', [GenerateController::class, 'store'])->name('generate');
    Route::get('generations/{generation}', [GenerateController::class, 'show'])->name('generation.show');

    Route::get('presentations/{presentation}/shares', [SharingController::class, 'index'])->name('shares.index');
    Route::put('presentations/{presentation}/shares/{user}', [SharingController::class, 'update'])->name('shares.update');
    Route::delete('presentations/{presentation}/shares/{user}', [SharingController::class, 'destroy'])->name('shares.destroy');
    Route::get('users/search', [SharingController::class, 'search'])->name('users.search');
});
