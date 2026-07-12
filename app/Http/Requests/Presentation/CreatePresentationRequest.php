<?php

namespace App\Http\Requests\Presentation;

use Illuminate\Foundation\Http\FormRequest;

final class CreatePresentationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
        ];
    }

    public function title(): ?string
    {
        return $this->filled('title') ? $this->string('title')->toString() : null;
    }

    public function teamId(): ?int
    {
        return $this->filled('team_id') ? (int) $this->integer('team_id') : null;
    }
}
