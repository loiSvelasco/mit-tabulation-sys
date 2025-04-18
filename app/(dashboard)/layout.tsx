import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "../globals.css";

export const metadata: Metadata = {
  title: "RankX - An advanced Tabulation System",
  description: "A capstone project by Louis Velasco for the completion of MIT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
