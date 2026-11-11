import { createBrowserRouter } from "react-router-dom";

import { CompanyName, LoginPage, LogoutButton, RequireAuth } from "../modules/auth";
import { HomePage } from "../modules/home";
import { ErrorPage } from "../shared/components/ErrorPage";
import { Layout } from "../shared/components/Layout";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout subtitle={<CompanyName />} headerActions={<LogoutButton />} />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <HomePage /> }],
  },
]);
