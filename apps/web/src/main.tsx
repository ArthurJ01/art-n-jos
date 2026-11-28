import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { ApiRequestError, keys } from './lib/api';
import { router } from './router';
import '@fontsource-variable/fraunces';
import './styles.css';

const isLoggedOutError = (error: Error) => error instanceof ApiRequestError && error.status === 401;

/**
 * Runs for every failed request. A 401 means the session has ended (it ran
 * out, or you logged out in another tab), so mark the user as logged out:
 * RequireAuth then shows the login page instead of a page full of errors.
 */
const onError = (error: Error) => {
  if (isLoggedOutError(error)) queryClient.setQueryData(keys.me, { authenticated: false });
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Try once more after a failure, unless the answer was "log in first".
      retry: (failures, error) => failures < 1 && !isLoggedOutError(error),
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
