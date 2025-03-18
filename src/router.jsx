import { createBrowserRouter, Navigate } from "react-router-dom";
import Signup from "./components/Signup";
import Signin from "./components/Signin";
import HomePage from "./components/HomePage";

const router = createBrowserRouter([  
  {
    path: "/",
    element: <Navigate to="/signin" replace />,
  },

  {
    path: "signup",
    element: <Signup />,
  },
  {
    path: "signin",
    element: <Signin />,
  },
  {
    path: "home",
    element: <HomePage />,
  },
]);

export default router;