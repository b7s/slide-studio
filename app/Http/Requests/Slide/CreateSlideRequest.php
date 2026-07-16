<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\CreateSlideData;
use Illuminate\Foundation\Http\FormRequest;

final class CreateSlideRequest extends FormRequest
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
            'title' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function payload(): CreateSlideData
    {
        return new CreateSlideData(
            presentationId: (int) $this->input('presentation_id'),
            title: $this->filled('title') ? $this->string('title')->toString() : null,
        );
    }
}
