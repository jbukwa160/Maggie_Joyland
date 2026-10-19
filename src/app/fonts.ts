import { Marck_Script, Nunito, Yeseva_One } from "next/font/google";

export const nunito = Nunito({ subsets: ["latin", "cyrillic"], variable: "--font-nunito", display: "swap" });
export const yeseva = Yeseva_One({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-yeseva", display: "swap" });
export const marck = Marck_Script({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-marck", display: "swap" });

export const fontVariables = `${nunito.variable} ${yeseva.variable} ${marck.variable}`;
