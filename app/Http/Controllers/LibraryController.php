<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

final class LibraryController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Library/Index');
    }
}
