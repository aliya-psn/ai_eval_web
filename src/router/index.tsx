import { useMemo } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { routes } from './routes';

export function AppRouter() {
  const router = useMemo(() => createHashRouter(routes), []);

  return <RouterProvider router={router} />;
}

export default AppRouter;
