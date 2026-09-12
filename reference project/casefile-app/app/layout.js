import "./globals.css";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Casefile — Job Application Tracker",
  description: "Track applications, tailor resumes, and log employer responses."
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B2430"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Special+Elite&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <Nav />
        <main className="main">{children}</main>
      </body>
    </html>
  );
}
