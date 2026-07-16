<?php

namespace App\Actions\Slide;

use App\Models\Slide;

// Small helper shared by the rename / duplicate / restore / create paths so
// every slide-row insert picks a filename that does not collide with another
// row in the same presentation. Returns `desired.html` when free, otherwise
// appends `-2`, `-3`, … until a free slot is found.
//
// `$excludeId` lets the rename path stay self-aware: when renaming slide 42
// to `foo.html`, the row that is *about to become* `foo.html` is row 42
// itself, so it must not count as a "different" collision. Pass null for
// inserts where the row does not yet exist.
final class UniqueSlideFilename
{
    public static function resolve(int $presentationId, string $desired, ?int $excludeId = null): string
    {
        $base = preg_replace('/\.html$/i', '', $desired) ?: 'slide';
        $filename = $desired;
        $suffix = 2;

        $query = Slide::query()
            ->where('presentation_id', $presentationId)
            ->where('filename', $filename);
        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        while ($query->exists()) {
            $filename = $base.'-'.$suffix.'.html';
            $suffix++;
            $query = Slide::query()
                ->where('presentation_id', $presentationId)
                ->where('filename', $filename);
            if ($excludeId !== null) {
                $query->where('id', '!=', $excludeId);
            }
        }

        return $filename;
    }
}
