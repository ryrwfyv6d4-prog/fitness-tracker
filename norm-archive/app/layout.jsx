import "./globals.css";

export const metadata = {
  title: "NormTube",
  description:
    "Every Norm Macdonald bit, roast, and interview the internet has, in one place. Streamed straight off the Internet Archive — nothing hosted, nothing to buffer through ads.",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "NormTube" },
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
