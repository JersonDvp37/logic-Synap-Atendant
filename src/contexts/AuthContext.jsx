import { createContext, useContext, useEffect, useState} from "react";
import { getSession, signIn, signOut, signUp } from "../services/authService";
import { supabase } from "../services/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  async function loadUser() {
    try {
      setAuthLoading(true);

      const { data, error } = await getSession();

      if (error) {
        console.error("Erro ao carregar utilizador:", error);
        setUser(null);
        return;
      }

      setUser(data?.session?.user ?? null);
    } catch (error) {
      console.error("Erro inesperado ao carregar utilizador:", error);
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function login(email, password) {
    const { data, error } = await signIn(email, password);

    if (error) {
      throw error;
    }

    setUser(data.user);

    return data;
  }

  async function register(email, password) {
    const { data, error } = await signUp(email, password);

    if (error) {
      throw error;
    }

    if (data.session && data.user) {
      setUser(data.user);
    }

    return data;
  }

  async function logout() {
    const { error } = await signOut();

    if (error) {
      throw error;
    }

    setUser(null);
  }

  useEffect(() => {
    loadUser();

    if (!supabase) {
      return undefined;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    authLoading,
    login,
    register,
    logout,
    refreshUser: loadUser,
    isAuthenticated: Boolean(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser utilizado dentro de AuthProvider"
    );
  }

  return context;
}
