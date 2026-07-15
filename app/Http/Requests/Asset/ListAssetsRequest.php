<?php

namespace App\Http\Requests\Asset;

use App\Data\Asset\ListAssetsData;
use Illuminate\Foundation\Http\FormRequest;

final class ListAssetsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'presentation' => ['nullable', 'integer', 'exists:presentations,id'],
            'sort' => ['nullable', 'string', 'in:last_used,uploaded'],
            'dir' => ['nullable', 'string', 'in:asc,desc'],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function payload(): ListAssetsData
    {
        return new ListAssetsData(
            presentationId: $this->filled('presentation') ? (int) $this->integer('presentation') : null,
            sort: (string) $this->input('sort', 'last_used'),
            dir: (string) $this->input('dir', 'desc'),
            search: $this->filled('search') ? $this->string('search')->toString() : null,
        );
    }
}
