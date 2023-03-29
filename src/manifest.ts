export default function manifest(mode: string) {
  const suffix = !mode || mode == "production" ? "" : " Dev";
  return {
    $schema: "https://json.schemastore.org/web-manifest-combined.json",
    name: "Kaicord" + suffix,
    short_name: "Discord" + suffix,
    description: "Kaicord is an unofficial Discord client for KaiOS 3.x devices.",
    theme_color: "#5865f2",
    background_color: "#23272a",
    icons: [
      {
        src: "/favicon.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/favicon.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    developer: {
      name: "diamondburned",
      url: "https://libdb.so",
    },
    locales: {
      "en-US": {
        name: "Kaicord" + suffix,
        subtitle: "Discord for KaiOS" + suffix,
        description: "Kaicord is an unofficial Discord client for KaiOS 3.x devices.",
      },
    },
    default_locale: "en-US",
  };
}
