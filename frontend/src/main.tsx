import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { Toaster } from "sonner";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <QueryClientProvider client={qc}>
            <BrowserRouter>
                <App />
                <Toaster richColors position="top-right" />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>
);

