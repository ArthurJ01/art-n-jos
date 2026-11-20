/**
 * Everything the frontend needs to talk to the API lives here.
 *
 * `request` is a thin wrapper around fetch, and the hooks below use TanStack Query,
 * which handles caching, loading states and refetching for us.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApiError, HealthResponse, Recipe, RecipeInput, RecipeQuery } from '@art-web/shared';

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Partial<ApiError>;
    throw new ApiRequestError(res.status, body.error ?? res.statusText, body.details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

// ---- Query keys: one place to define how cached data is identified ----
export const keys = {
  recipes: (query: RecipeQuery = {}) => ['recipes', query] as const,
  recipe: (id: number) => ['recipe', id] as const,
  me: ['me'] as const,
  health: ['health'] as const,
};

// ---- Recipes ----
export function useRecipes(query: RecipeQuery) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.tag) params.set('tag', query.tag);
  const qs = params.toString();
  return useQuery({
    queryKey: keys.recipes(query),
    queryFn: () => request<Recipe[]>(`/recipes${qs ? `?${qs}` : ''}`),
  });
}

export function useRecipe(id: number) {
  return useQuery({
    queryKey: keys.recipe(id),
    queryFn: () => request<Recipe>(`/recipes/${id}`),
    enabled: Number.isFinite(id),
  });
}

export function useSaveRecipe(id?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RecipeInput) =>
      request<Recipe>(id ? `/recipes/${id}` : '/recipes', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (recipe) => {
      qc.setQueryData(keys.recipe(recipe.id), recipe);
      return qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

// ---- Auth ----
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: () => request<{ authenticated: boolean }>('/auth/me'),
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) =>
      request<{ authenticated: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: (data) => qc.setQueryData(keys.me, data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request<{ authenticated: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: (data) => qc.setQueryData(keys.me, data),
  });
}

// ---- Health (used to show which environment you're looking at) ----
export function useHealth() {
  return useQuery({
    queryKey: keys.health,
    queryFn: () => request<HealthResponse>('/health'),
    staleTime: Infinity,
  });
}
