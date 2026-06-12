import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-context";

export const metadata: Metadata = {
  title: "SupplySense AI — Supply Chain Intelligence for US Manufacturers",
  description:
    "Upload your inventory spreadsheet. Get AI-powered risk scores, dead stock analysis, ABC classification, and an executive brief in under 60 seconds.",
  keywords: "supply chain analytics, inventory management, dead stock, stockout risk, ABC analysis, SME manufacturing",
  authors: [{ name: "SupplySense AI" }],
  robots: "index, follow",
};

// Inline script injected before React hydrates — prevents flash of wrong theme
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('supplysense_theme');
    if (t === 'light' || t === 'dark' || t === 'professional') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply stored theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Favicon — inline SVG data URI, no file dependency */}
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%236366f1'/><text x='50%25' y='54%25' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='800' font-size='18' fill='white'>S</text></svg>"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
          crossOrigin="anonymous"
        />
        <meta name="theme-color" content="#020617" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="h-full antialiased" suppressHydrationWarning>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
