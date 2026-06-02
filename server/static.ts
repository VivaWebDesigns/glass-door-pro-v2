import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { buildHeadTags } from "./page-meta";

type RenderFn = (url: string) => { html: string };

export async function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const ssrPath = path.resolve(process.cwd(), "dist", "server", "entry-server.cjs");
  if (!fs.existsSync(ssrPath)) {
    throw new Error(
      `Could not find the SSR bundle: ${ssrPath}, make sure to build the SSR entry first`,
    );
  }

  const _require = createRequire(path.join(process.cwd(), "package.json"));
  const { render } = _require(ssrPath) as { render: RenderFn };

  const templateHtml = fs.readFileSync(
    path.resolve(distPath, "index.html"),
    "utf-8",
  );

  app.use(express.static(distPath, { index: false }));

  app.use("/{*path}", async (req, res) => {
    try {
      const { html: appHtml } = render(req.originalUrl);
      const headHtml = await buildHeadTags(req.originalUrl);
      const html = templateHtml
        .replace("<!--ssr-head-->", headHtml)
        .replace("<!--app-html-->", appHtml);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      console.error("SSR render error:", err);
      res.status(500).end("Internal Server Error");
    }
  });
}
