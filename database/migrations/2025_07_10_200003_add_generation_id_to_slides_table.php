<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('slides', function (Blueprint $table): void {
            $table->foreignId('generation_id')->nullable()->after('presentation_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('slides', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('generation_id');
        });
    }
};
