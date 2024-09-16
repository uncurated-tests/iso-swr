import type { Metadata } from "next";
import "./globals.css";
import { IsomorphicSwrProvider } from "./lib/provider-server";

export const metadata: Metadata = {
  title: "Isomorphic SWR",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <IsomorphicSwrProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </IsomorphicSwrProvider>
  );
}
