<?php

namespace App\Http\Middleware;

use App\Models\Company;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The SPA sends the active company as an "X-Company-Id" header. This verifies
 * the authenticated user belongs to that company, then exposes it two ways:
 *
 *   - request()->attributes->get('company')      — for API controllers
 *   - the "current_company" route parameter        — so form requests /
 *     resources that resolve the current company keep working.
 */
class ResolveApiCompany
{
    public function handle(Request $request, Closure $next): Response
    {
        $companyId = $request->header('X-Company-Id');

        if (! $companyId) {
            return response()->json(['message' => 'Select a company (X-Company-Id header is required).'], 422);
        }

        $company = Company::find($companyId);

        if (! $company || ! $request->user()->companies()->whereKey($company->id)->exists()) {
            return response()->json(['message' => 'You do not have access to this company.'], 403);
        }

        $request->attributes->set('company', $company);
        $request->route()?->setParameter('current_company', $company);

        return $next($request);
    }
}
