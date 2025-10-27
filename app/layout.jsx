import "./globals.css";
import AuthWatcher from "@/components/AuthWatcher";

export const metadata = {
  title: "Hansen IT Portal",
  description: "Internt adminpanel (SSO + CRM)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>
        <AuthWatcher />
        {children}
      </body>
    </html>
  );
}
