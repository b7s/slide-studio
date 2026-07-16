<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\RestoreSlideData;
use App\Enums\Slide\SourceMode;
use Illuminate\Foundation\Http\FormRequest;

final class RestoreSlideRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'presentation_id' => ['required', 'integer', 'exists:presentations,id'],
            'filename' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'position' => ['required', 'integer', 'min:1'],
            'html' => ['required', 'string'],
            'source_mode' => ['required', 'string', 'in:deck,template'],
            'revision' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function payload(): RestoreSlideData
    {
        return new RestoreSlideData(
            presentationId: (int) $this->input('presentation_id'),
            filename: $this->string('filename')->toString(),
            title: $this->string('title')->toString(),
            position: (int) $this->input('position'),
            html: $this->string('html')->toString(),
            sourceMode: SourceMode::from($this->string('source_mode')->toString())->value,
            revision: $this->filled('revision') ? $this->string('revision')->toString() : null,
        );
    }
}
