import React, { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";

export const AdminLogin: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/login", { replace: true });
  }, [navigate]);

  return <Navigate to="/login" replace />;
};
