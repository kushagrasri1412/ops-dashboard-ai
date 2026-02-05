import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata = {
  title: "Restaurant Digital Ops Dashboard",
  description: "Stripe-style ops dashboard with AI copilot and observability.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased"
      >
        {children}
      </body>
    </html>
  );
}
