import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps/web/package.json"));
const sharp = createRequire(require.resolve("next/package.json"))("sharp");
const directory = path.join(root, "apps/mobile/assets");
await mkdir(directory, { recursive: true });
// One seed-shaped O and a small new leaf: a reusable mark, without text at icon sizes.
const mark = (color) =>
  `<path d="M660 332C624 298 571 282 517 287C411 297 339 386 347 501C355 623 444 708 552 699C654 691 718 603 710 492C706 442 691 410 669 381" fill="none" stroke="${color}" stroke-width="82" stroke-linecap="round"/><path d="M550 442C548 354 599 304 689 301C688 391 638 444 550 442Z" fill="${color}"/>`;
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
const foreground = svg(mark("#687A45"));
const icon = svg(`<rect width="1024" height="1024" fill="#FBF6ED"/>${mark("#687A45")}`);
await writeFile(path.join(directory, "ownday-mark.svg"), foreground);
await writeFile(path.join(directory, "ownday-icon.svg"), icon);
await sharp(Buffer.from(icon)).png().toFile(path.join(directory, "icon.png"));
await sharp(Buffer.from(foreground)).png().toFile(path.join(directory, "adaptive-icon.png"));
await sharp(Buffer.from(foreground))
  .resize(512, 512)
  .png()
  .toFile(path.join(directory, "splash.png"));
await sharp(Buffer.from(svg(mark("#FFFFFF"))))
  .resize(96, 96)
  .png()
  .toFile(path.join(directory, "notification.png"));
await mkdir(path.join(root, "apps/web/public"), { recursive: true });
await sharp(Buffer.from(icon))
  .resize(180, 180)
  .png()
  .toFile(path.join(root, "apps/web/public/apple-touch-icon.png"));
await writeFile(path.join(root, "apps/web/public/icon.svg"), icon);
console.log("Ownday SVG and PNG assets generated.");
