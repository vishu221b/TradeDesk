import { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Landing } from "./pages/Landing";
import { Workspace } from "./components/Workspace";
import { Spin } from "./components/ui";

export default function App() {
  const { user, loading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) return <Spin />;
  if (user) return <Workspace />;
  return showLogin ? (
    <Login onBack={() => setShowLogin(false)} />
  ) : (
    <Landing onGetStarted={() => setShowLogin(true)} />
  );
}
