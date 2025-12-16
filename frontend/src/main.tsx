import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import { MonedasProvider } from "./context/MonedasContext";

const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={qc}>
            <AuthProvider>
                <MonedasProvider>
                    <BrowserRouter>
                        <App />
                        <Toaster position="top-right" reverseOrder={false} toastOptions={{ duration: 4000 }} />
                    </BrowserRouter>
                </MonedasProvider>
            </AuthProvider>
        </QueryClientProvider>
    </React.StrictMode>
);

