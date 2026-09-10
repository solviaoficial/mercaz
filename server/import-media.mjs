import https from "node:https";
import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./db.mjs";

export function publicIP(address) {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}
export async function resolveImageUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443"))
    throw Error("A foto precisa ter uma URL HTTPS pública.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const records = ipaddr.isValid(host)
    ? [{ address: host, family: ipaddr.parse(host).kind() === "ipv4" ? 4 : 6 }]
    : await lookup(host, { all: true });
  if (!records.length || records.some((r) => !publicIP(r.address)))
    throw Error("Endereço de imagem não permitido.");
  return { url: u, address: records[0] };
}
export function imageType(b) {
  if (b.length < 16) return null;
  if (b.subarray(0, 3).toString("hex") === "ffd8ff") return ["jpg", "image/jpeg"];
  if (b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return ["png", "image/png"];
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP")
    return ["webp", "image/webp"];
  return null;
}
async function download(raw, signal, redirects = 0) {
  const { url, address } = await resolveImageUrl(raw);
  signal.throwIfAborted();
  const response = await new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        signal,
        agent: false,
        headers: { Accept: "image/jpeg,image/png,image/webp", "Accept-Encoding": "identity" },
        lookup: (_host, options, cb) =>
          cb(null, options?.all ? [address] : address.address, address.family),
      },
      resolve,
    );
    req.on("error", reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    response.destroy();
    if (redirects >= 3 || !response.headers.location)
      throw Error("Redirecionamento de foto inválido.");
    return download(new URL(response.headers.location, url).href, signal, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.destroy();
    throw Error("A origem não disponibilizou a foto.");
  }
  const max = 5 * 1024 * 1024;
  if (Number(response.headers["content-length"]) > max) {
    response.destroy();
    throw Error("Foto maior que 5 MB.");
  }
  const chunks = [];
  let size = 0;
  for await (const c of response) {
    size += c.length;
    if (size > max) {
      response.destroy();
      throw Error("Foto maior que 5 MB.");
    }
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}
export async function saveRemoteImage(url) {
  // DNS results are validated and pinned; each redirect is checked again.
  const signal = AbortSignal.timeout(12000);
  const b = await Promise.race([
    download(url, signal),
    new Promise((_, reject) =>
      signal.addEventListener("abort", () => reject(Error("Tempo de download da foto excedido.")), {
        once: true,
      }),
    ),
  ]);
  const type = imageType(b);
  if (!type) throw Error("A URL não retornou uma foto JPG, PNG ou WebP.");
  const name = randomUUID() + "." + type[0];
  await writeFile(path.join(dataDir, "uploads", name), b, { flag: "wx" });
  return { url: "/uploads/" + name, type: type[1] };
}
export async function discardImage(image) {
  await unlink(path.join(dataDir, "uploads", path.basename(image.url))).catch(() => {});
}
