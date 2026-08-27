import fs from "fs";
import path from "path";

export interface LargeAsset {
  file: string;
  sizeKb: number;
  format: string;
  estimatedWebpSizeKb: number;
  potentialSavingsKb: number;
}

export function auditAssets(targetDir: string = process.cwd(), thresholdKb: number = 250): {
  scannedFilesCount: number;
  largeAssets: LargeAsset[];
  totalPotentialSavingsMb: number;
} {
  const largeAssets: LargeAsset[] = [];
  const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);
  let scannedFilesCount = 0;

  function traverse(dir: string) {
    let entries: string[] = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue;
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (stat.isFile()) {
        scannedFilesCount++;
        const ext = path.extname(entry).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff"].includes(ext)) {
          const sizeKb = Math.round(stat.size / 1024);
          if (sizeKb >= thresholdKb) {
            // WebP typically compresses raster images by 70-85%
            const estimatedWebpSizeKb = Math.round(sizeKb * 0.22);
            const potentialSavingsKb = sizeKb - estimatedWebpSizeKb;
            largeAssets.push({
              file: path.relative(targetDir, fullPath),
              sizeKb,
              format: ext.slice(1).toUpperCase(),
              estimatedWebpSizeKb,
              potentialSavingsKb,
            });
          }
        }
      }
    }
  }

  traverse(targetDir);
  const totalSavingsKb = largeAssets.reduce((acc, a) => acc + a.potentialSavingsKb, 0);

  return {
    scannedFilesCount,
    largeAssets: largeAssets.sort((a, b) => b.sizeKb - a.sizeKb),
    totalPotentialSavingsMb: parseFloat((totalSavingsKb / 1024).toFixed(2)),
  };
}

export async function checkPerformanceHeaders(url: string): Promise<{
  url: string;
  statusCode: number;
  compression: string;
  cacheControl: string;
  securityHeaders: { name: string; present: boolean; value?: string }[];
  recommendations: string[];
}> {
  const recommendations: string[] = [];
  const response = await fetch(url, { method: "HEAD" });

  const headers = response.headers;
  const compression = headers.get("content-encoding") || "None (Uncompressed)";
  const cacheControl = headers.get("cache-control") || "Not Set";

  if (compression === "None (Uncompressed)") {
    recommendations.push("Enable Gzip or Brotli compression on your web server / CDN to save 60-80% bandwidth.");
  }
  if (cacheControl === "Not Set" || !cacheControl.includes("max-age")) {
    recommendations.push("Configure explicit Cache-Control headers with max-age for static assets.");
  }

  const securityCheck = [
    { name: "Strict-Transport-Security", present: headers.has("strict-transport-security"), value: headers.get("strict-transport-security") || undefined },
    { name: "X-Content-Type-Options", present: headers.has("x-content-type-options"), value: headers.get("x-content-type-options") || undefined },
    { name: "X-Frame-Options", present: headers.has("x-frame-options"), value: headers.get("x-frame-options") || undefined },
    { name: "Content-Security-Policy", present: headers.has("content-security-policy"), value: headers.get("content-security-policy") || undefined },
  ];

  securityCheck.forEach((h) => {
    if (!h.present) {
      recommendations.push(`Missing security header: ${h.name}`);
    }
  });

  return {
    url,
    statusCode: response.status,
    compression,
    cacheControl,
    securityHeaders: securityCheck,
    recommendations,
  };
}
