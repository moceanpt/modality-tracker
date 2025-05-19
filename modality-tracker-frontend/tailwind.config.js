/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
      './app/**/*.{js,ts,jsx,tsx}',   // ← if you use the App router
    ],
    theme: {
      extend: {
        /* custom break-points */
        screens: {
          xs  : '480px',   // bigger phones in portrait
          sm  : '640px',   // large phones / small tablets
          ipad: '820px',   // iPad 10th-gen & up
          lg  : '1024px',  // iPad Pro 12.9″ & desktop ≤ 1024 px
          xl  : '1280px',
        },
      },
    },
  
    plugins: [],
  };