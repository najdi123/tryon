import type { MetadataRoute } from "next";

// A website cannot stop a phone's browser from turning. This asks for portrait where the app is
// installed to the home screen; in the browser the page keeps its phone-width column either way.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "آینه‌رنگ | زیبارخ قشم",
    short_name: "آینه‌رنگ",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "fa",
    dir: "rtl",
    background_color: "#f1f7f8",
    theme_color: "#f1f7f8",
  };
}
