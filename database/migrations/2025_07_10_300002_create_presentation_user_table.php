<?php

use App\Enums\Sharing\PresentationRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('presentation_user', function (Blueprint $table): void {
            $table->foreignId('presentation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('role')->default(PresentationRole::Viewer->value);
            $table->timestamps();

            $table->primary(['presentation_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presentation_user');
    }
};
