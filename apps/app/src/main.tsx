import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app";
import "@vscode/codicons/dist/codicon.css";
import "devicon/devicon.min.css";
import "@/lib/register-diffs-theme";
import "./styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
