import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Workspace } from "./components/Workspace";
import { Spin } from "./components/ui";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spin />;
  if (!user) return <Login />;
  return <Workspace />;
}
