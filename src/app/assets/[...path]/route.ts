import { getAsset } from "@/collection/collection";
import { decodeUrlSegments } from "@/collection/urls";
import { ownerId } from "../../owner";

export async function GET(_request: Request, { params }: RouteContext<"/assets/[...path]">) {
  const assetPath = decodeUrlSegments((await params).path);
  if (assetPath === null) return notFoundResponse();
  const asset = await getAsset(await ownerId(), assetPath);
  if (!asset) return notFoundResponse();
  return new Response(new Uint8Array(asset.content), {
    headers: {
      "Content-Type": asset.mediaType,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // An SVG file can hold scripts. This policy stops them when the browser opens the asset URL directly.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

function notFoundResponse() {
  return new Response("Not found", { status: 404 });
}
