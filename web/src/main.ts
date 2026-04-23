import { createApp } from "vue";
import App from "./App.vue";
import "./main.css";
import { applyTheme, getStoredTheme } from "./lib/theme";

applyTheme(getStoredTheme());

createApp(App).mount("#app");
