import "./styles/main.css";
import "./styles/enka-sync.css";
import { initApp } from "./ui/workbench";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
