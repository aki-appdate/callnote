import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // 開発中の「instant navigation / Dropped segment」の自動チェックを、instant を書いた画面だけに絞る。
    // 画面はデータを読み込み終えるまで中身を出さない作り（(app)/layout.tsx）なので、全画面の自動チェックは誤検知になる。
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
