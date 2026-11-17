import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// The font file lives in the project (app/fonts, SIL Open Font License), so neither the build
// nor a customer's phone asks Google for it.
const vazirmatn = localFont({
  src: "./fonts/Vazirmatn-wght.woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "آینه‌رنگ | زیبارخ قشم",
  description:
    "رنگ موی جدیدت رو قبل از رنگ کردن ببین. آینه‌رنگ، پیش‌نمایش رنگ مو با رنگ‌های بیانکا و اویستر.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
