"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MyApp;
// pages/_app.tsx
require("@/styles/globals.css");
function MyApp({ Component, pageProps }) {
    return <Component {...pageProps}/>;
}
