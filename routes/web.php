<?php

use App\Http\Controllers\EditorController;
use App\Http\Controllers\LibraryController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth')->group(function (): void {
    Route::get('/', [EditorController::class, 'index']);
    Route::get('/presentations/{presentation}', [EditorController::class, 'index'])->name('editor');
    Route::get('/library', [LibraryController::class, 'index'])->name('library');
});
