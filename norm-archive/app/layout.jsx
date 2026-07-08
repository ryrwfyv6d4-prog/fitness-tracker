import "./globals.css";

export const metadata = {
  title: "Norm Macdonald Archive",
  description:
    "A curated library for browsing and streaming the Norm Macdonald Archive, served directly from the Internet Archive.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
