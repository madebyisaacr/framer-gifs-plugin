import "./App.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import { framer } from "framer-plugin";

const GITHUB_URL = "https://github.com/madebyisaacr/framer-gifs-plugin";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			staleTime: 1000 * 60 * 5,
			refetchOnWindowFocus: false,
			throwOnError: true,
		},
	},
});

framer.setMenu([
	{
		label: "View Code on GitHub",
		onAction: () => {
			try {
				window.open(GITHUB_URL, "_blank");
			} catch (error) {
				console.error(error);
				framer.notify(`Failed to open link: ${GITHUB_URL}`, { variant: "error" });
			}
		},
	},
]);

ReactDOM.createRoot(root).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</React.StrictMode>
);
