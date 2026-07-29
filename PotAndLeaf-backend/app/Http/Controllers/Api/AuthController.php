<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Api\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Token auth for the decoupled SPA (Laravel Sanctum personal access tokens).
 *
 * Requires: composer require laravel/sanctum, and `use HasApiTokens` on the
 * User model. See the API README for the one-time setup.
 */
class AuthController extends Controller
{
    use ApiResponse;

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = \App\Models\User::where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Those credentials do not match our records.',
            ]);
        }

        $token = $user->createToken('spa')->plainTextToken;

        return $this->ok([
            'token'     => $token,
            'user'      => $this->userPayload($user),
            'companies' => $this->companies($user),
        ], 'Signed in.');
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->ok([
            'user'      => $this->userPayload($user),
            'companies' => $this->companies($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return $this->message('Signed out.');
    }

    /** Permission names for the current company, so the SPA can gate its UI. */
    public function permissions(Request $request): JsonResponse
    {
        $company = $request->attributes->get('company');

        return $this->ok(
            $request->user()->permissionNamesForCompany($company->id)->values()
        );
    }

    private function userPayload($user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email];
    }

    private function companies($user): array
    {
        return $user->companies()
            ->get(['companies.id', 'companies.name', 'companies.code'])
            ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'code' => $c->code])
            ->all();
    }
}
