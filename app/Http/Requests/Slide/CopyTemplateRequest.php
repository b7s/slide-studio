<?php

namespace App\Http\Requests\Slide;

use App\Data\Slide\CopyTemplateData;
use Illuminate\Foundation\Http\FormRequest;

final class CopyTemplateRequest extends FormRequest
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

    public function payload(): CopyTemplateData
    {
        return new CopyTemplateData(
            presentationId: (int) $this->integer('presentation_id'),
            title: $this->filled('title') ? $this->string('title')->toString() : null,
        );
    }
}
