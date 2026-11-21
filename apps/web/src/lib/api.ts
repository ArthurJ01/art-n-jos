/**
 * Everything the frontend needs to talk to the API lives here.
 *
 * `request` is a thin wrapper around fetch, and the hooks below use TanStack Query,
 * which handles caching, loading states and refetching for us.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiError,
  HealthResponse,
  MealPlanEntry,
  MealPlanEntryInput,
  MealPlanMove,
  Recipe,
  RecipeInput,
  RecipeQuery,
} from '@art-web/shared';

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
  mealPlan: (from: string, to: string) => ['mealPlan', from, to] as const,
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
      // The meal plan shows recipe titles, so it may be out of date too.
      void qc.invalidateQueries({ queryKey: mealPlanKey });
      return qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useDeleteRecipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => request<void>(`/recipes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Deleting a recipe also removes it from the meal plan.
      void qc.invalidateQueries({ queryKey: mealPlanKey });
      return qc.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

// ---- Meal plan ----
/** Prefix of every meal plan query key, to invalidate all cached weeks at once. */
const mealPlanKey = ['mealPlan'] as const;

export function useMealPlan(from: string, to: string) {
  return useQuery({
    queryKey: keys.mealPlan(from, to),
    queryFn: () => request<MealPlanEntry[]>(`/meal-plan?from=${from}&to=${to}`),
  });
}

type MealPlanSnapshot = [readonly unknown[], MealPlanEntry[] | undefined][];

/**
 * A meal plan mutation with an "optimistic update": the calendar changes
 * right away instead of waiting for the server, which is what makes drag and
 * drop feel instant. If the request fails, the old data is put back.
 *
 * `apply` describes the change: it gets the cached entries for one week
 * (`range`) and returns what they should look like after the mutation.
 */
function useMealPlanMutation<TVars, TData>(
  mutationFn: (vars: TVars) => Promise<TData>,
  apply: (
    entries: MealPlanEntry[],
    vars: TVars,
    range: { from: string; to: string },
  ) => MealPlanEntry[],
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars, { snapshot: MealPlanSnapshot }>({
    mutationKey: mealPlanKey,
    mutationFn,
    onMutate: async (vars) => {
      // Stop any fetch in flight so it can't overwrite the optimistic data.
      await qc.cancelQueries({ queryKey: mealPlanKey });
      const snapshot = qc.getQueriesData<MealPlanEntry[]>({ queryKey: mealPlanKey });
      for (const [key, entries] of snapshot) {
        if (!entries) continue;
        const [, from, to] = key as ReturnType<typeof keys.mealPlan>;
        qc.setQueryData(key, apply(entries, vars, { from, to }));
      }
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, entries]) => qc.setQueryData(key, entries));
    },
    onSettled: () => {
      // Refetch to get the real data, but only once the last change is done.
      // Otherwise a refetch could briefly undo a newer optimistic change.
      if (qc.isMutating({ mutationKey: mealPlanKey }) === 1) {
        return qc.invalidateQueries({ queryKey: mealPlanKey });
      }
    },
  });
}

/** Optimistic entries get negative ids until the server has given them a real one. */
let nextTempId = -1;
export const isSavedEntry = (entry: MealPlanEntry) => entry.id > 0;

export function useAddMealPlanEntry() {
  return useMealPlanMutation(
    // recipeTitle is only used to show the entry before the server has answered.
    ({ input }: { input: MealPlanEntryInput; recipeTitle: string | null }) =>
      request<MealPlanEntry>('/meal-plan', { method: 'POST', body: JSON.stringify(input) }),
    (entries, { input, recipeTitle }, { from, to }) =>
      input.date < from || input.date > to
        ? entries
        : [
            ...entries,
            {
              id: nextTempId--,
              date: input.date,
              meal: input.meal,
              kind: input.kind,
              recipeId: input.recipeId ?? null,
              recipeTitle,
              title: input.title ?? null,
              isLeftover: input.isLeftover ?? false,
            },
          ],
  );
}

export function useMoveMealPlanEntry() {
  return useMealPlanMutation(
    ({ id, ...slot }: MealPlanMove & { id: number }) =>
      request<MealPlanEntry>(`/meal-plan/${id}`, { method: 'PATCH', body: JSON.stringify(slot) }),
    (entries, { id, date, meal }) => entries.map((e) => (e.id === id ? { ...e, date, meal } : e)),
  );
}

export function useDeleteMealPlanEntry() {
  return useMealPlanMutation(
    (id: number) => request<void>(`/meal-plan/${id}`, { method: 'DELETE' }),
    (entries, id) => entries.filter((e) => e.id !== id),
  );
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
