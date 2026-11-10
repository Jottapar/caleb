import { createBrowserRouter } from "react-router-dom";

import { HomePage } from "../modules/home";
import { ErrorPage } from "../shared/components/ErrorPage";
import { Layout } from "../shared/components/Layout";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [{ index: true, element: <HomePage /> }],
  },
]);
