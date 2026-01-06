import "./globals.css";

export const metadata = {
  title: "Hansen IT Portal",
  description: "Internt adminpanel (SSO + CRM)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="no">
      <body>
        {children}
      </body>
    </html>
  );
}
