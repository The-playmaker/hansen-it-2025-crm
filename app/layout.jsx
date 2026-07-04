import "./globals.css";

export const metadata = {
  title: "Hansen IT Portal",
  description: "Internt adminpanel (SSO + CRM)",
  icons: {
    icon: [
      { url: "/brand/hansen-it/favicon/favicon.ico" },
      { url: "/brand/hansen-it/favicon/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/hansen-it/favicon/favicon-64.png", sizes: "64x64", type: "image/png" }
    ],
    apple: [{ url: "/brand/hansen-it/favicon/favicon-180.png", sizes: "180x180", type: "image/png" }]
  }
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
