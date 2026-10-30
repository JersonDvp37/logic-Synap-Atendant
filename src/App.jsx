import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./AppRouter";
import { AuthProvider } from "./contexts/AuthContext";
import { CompanyProvider } from "./contexts/CompanyContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import styles from "./App.module.css";

export default function App() {
  return (
    <div className={styles.root}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <CompanyProvider>
              <AppRouter />
            </CompanyProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


/* Alguns digitalizados ou scaneados - o que podem vir sem texto extraido, entao apenas diga recebido se nao tiver nenhuma texto extraido. Essa parte e uma excepcao.
 so serve para */