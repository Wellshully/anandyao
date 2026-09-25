import "server-only";

import sanitizeHtml from "sanitize-html";

export function sanitizeStudyHtml(html: string | null | undefined) {
  if (!html) {
    return "";
  }

  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],

    allowedAttributes: {
      a: ["href", "title", "target", "rel"],

      img: ["src", "alt", "title", "width", "height"],

      table: ["border"],

      td: ["colspan", "rowspan"],

      th: ["colspan", "rowspan"],
    },

    allowedSchemes: ["http", "https", "mailto"],

    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",

          rel: "noopener noreferrer",
        },
      }),
    },
  });
}
