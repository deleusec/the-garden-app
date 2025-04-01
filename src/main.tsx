import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import HomeView from './app'
import { createBrowserRouter, RouterProvider } from 'react-router';
import GardenView from './app/garden';

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeView />,
  },
  {
    path: "/garden",
    element: <GardenView />
  }
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
