import "./globals.css";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";

export const metadata = {
  title: "ReachInbox Scheduler",
  description: "Email job scheduler dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
