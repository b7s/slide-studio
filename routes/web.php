<?php

use App\Http\Controllers\EditorController;
use Illuminate\Support\Facades\Route;

Route::get('/', [EditorController::class, 'index']);
Route::get('/presentations/{presentation}', [EditorController::class, 'index']);
