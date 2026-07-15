<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_used_at')->nullable()->after('mime');
            $table->dropForeign(['presentation_id']);
            $table->dropColumn('presentation_id');
        });
    }

    public function down(): void
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn(['user_id', 'last_used_at']);
            $table->foreignId('presentation_id')->constrained()->cascadeOnDelete();
        });
    }
};
