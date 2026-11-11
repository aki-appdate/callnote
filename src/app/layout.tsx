import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "CallNote｜テレアポチームのAI営業アシスタント",
  description: "架電メモをAIが整理し、次の一手とチームの傾向を見える化するデモアプリ（データはすべて架空）",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${noto.variable} h-full`}>
      <body className="min-h-full">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
