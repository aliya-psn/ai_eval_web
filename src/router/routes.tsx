import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';

// Loading component
function PageLoading() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-muted border-t-primary"></div>
    </div>
  );
}

// Lazy load wrapper
function lazyPage(
  importFn: () => Promise<{ default: React.ComponentType }>
) {
  const LazyComponent = lazy(importFn);
  return (
    <Suspense fallback={<PageLoading />}>
      <LazyComponent />
    </Suspense>
  );
}

function DefaultRedirect() {
  return <Navigate to="/skill" replace />;
}

// Layouts
const AppLayout = lazy(() => import('@/layouts/AppLayout'));

export const routes: RouteObject[] = [
  // Routes with AppLayout
  {
    element: (
      <Suspense fallback={<PageLoading />}>
        <AppLayout />
      </Suspense>
    ),
    children: [
      // Default redirect
      {
        index: true,
        element: <DefaultRedirect />,
      },
      // AI Registry
      {
        path: 'agentManagement',
        element: lazyPage(() => import('@/pages/agentManagement')),
      },
      {
        path: 'agentManagement/http/edit',
        element: lazyPage(() => import('@/pages/agentManagement/HttpAgentForm')),
      },
      {
        path: 'agentManagement/http/detail',
        element: lazyPage(() => import('@/pages/agentManagement/HttpAgentDetail')),
      },
      {
        path: 'skill',
        element: lazyPage(() => import('@/pages/skillManagement')),
      },
      {
        path: 'skillDetail',
        element: lazyPage(() => import('@/pages/skillDetail')),
      },
      {
        path: 'datasetManagement',
        element: lazyPage(() => import('@/pages/dataset/datasetManagement')),
      },
      {
        path: 'datasetDetail',
        element: lazyPage(() => import('@/pages/dataset/datasetDetail')),
      },
      {
        path: 'datasetExperimentDetail',
        element: lazyPage(() => import('@/pages/dataset/datasetExperimentDetail')),
      },
    ],
  },

  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
];
