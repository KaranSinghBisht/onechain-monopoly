// /frontend/src/main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";
import { WalletProvider } from "./wallet/WalletProvider";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WalletProvider>
          <App />
        </WalletProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
