<?php

namespace App\Http\Requests\Presentation;

use App\Data\Presentation\ListPresentationsData;
use Illuminate\Foundation\Http\FormRequest;

final class ListPresentationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'group' => ['required', 'string', 'in:personal,team,shared'],
            'team_id' => ['nullable', 'integer', 'exists:teams,id'],
            'q' => ['nullable', 'string', 'max:255'],
            'sort' => ['nullable', 'string', 'in:name,title,updated_at,created_at'],
            'dir' => ['nullable', 'string', 'in:asc,desc'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:60'],
        ];
    }

    public function payload(): ListPresentationsData
    {
        return new ListPresentationsData(
            group: (string) $this->input('group', 'personal'),
            teamId: $this->filled('team_id') ? (int) $this->integer('team_id') : null,
            query: $this->filled('q') ? $this->string('q')->toString() : null,
            sort: (string) $this->input('sort', 'updated_at'),
            dir: (string) $this->input('dir', 'desc'),
            page: (int) $this->input('page', 1),
            perPage: (int) $this->input('per_page', 12),
        );
    }
}
