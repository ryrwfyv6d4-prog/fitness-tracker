import "./globals.css";

export const metadata = {
  title: "Norm Macdonald Archive",
  description:
    "A curated library for browsing and streaming the Norm Macdonald Archive, served directly from the Internet Archive.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Norm Archive" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0e1114",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://archive.org" />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
