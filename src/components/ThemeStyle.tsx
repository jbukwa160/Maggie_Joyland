import { getSettings } from "@/lib/settings";

const HEX = /^#[0-9a-f]{3,8}$/i;

/** Injects the brand colours chosen in Admin → Settings → Appearance on top of globals.css. */
export async function ThemeStyle() {
  const { theme } = await getSettings();
  const vars = Object.entries(theme)
    .filter(([, v]) => HEX.test(v))
    .map(([k, v]) => `--brand-${k}:${v};`)
    .join("");
  return <style id="brand-colours" dangerouslySetInnerHTML={{ __html: `:root{${vars}}` }} />;
}
