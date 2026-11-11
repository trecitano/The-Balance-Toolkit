import type { IconName } from "@/components/Icons.tsx";

// Everything the welcome page links to, in one place.
export type HomeLink = {
  label: string;
  icon: IconName;
  /** Opened in the system browser. A link without one opens the citation dialog instead. */
  url?: string;
};

const REPOSITORY_URL = "https://github.com/trecitano/The-Balance-Toolkit";

export const helpLinks: HomeLink[] = [
  { label: "Watch the walkthrough", icon: "play", url: "https://youtu.be/_8UwrUgqUao" },
  { label: "Report a problem", icon: "issue", url: `${REPOSITORY_URL}/issues` },
  { label: "Email the team", icon: "mail", url: "mailto:andreia.valente@auckland.ac.nz" },
];

export const documentationLinks: HomeLink[] = [
  { label: "Installation", icon: "install", url: `${REPOSITORY_URL}/blob/main/INSTALL.md` },
  { label: "Quick start", icon: "start", url: `${REPOSITORY_URL}#quick-start` },
  { label: "Data streams", icon: "stream", url: `${REPOSITORY_URL}#data-stream-reference` },
  { label: "Developer guide", icon: "code", url: `${REPOSITORY_URL}/blob/main/docs/DEVELOPMENT.md` },
];

/** Shown with the ACM logo rather than an icon. */
export const paperLink = { label: "Read the paper", url: "https://dl.acm.org/doi/10.1145/3831299" };

export const resourceLinks: HomeLink[] = [
  { label: "Website", icon: "globe", url: "https://thebalancetoolkit.com/" },
  { label: "Source code", icon: "github", url: REPOSITORY_URL },
  { label: "Get the apps", icon: "download", url: "https://github.com/AndreiaValente/The-Balance-Toolkit-Apps" },
  { label: "Cite", icon: "cite" },
];

export const CITATION_APA =
  "Valente, A., Kothari, N., Ahmed-Mahmoud, H., Esteves, A., & Billinghurst, M. (2026). The Balance Toolkit: Democratizing balance-based interaction through open-source software for repurposed Wii Balance Boards. Proceedings of the ACM on Human-Computer Interaction, 10(7), Article GAMES067. https://doi.org/10.1145/3831299";

const KEYWORDS = [
  "Wii Balance Board",
  "Balance-based interaction",
  "Posturography",
  "Exergaming",
  "Open-source software",
  "Windows",
  "macOS",
  "Linux",
  "Android",
  "Unity",
];

export const CITATION_BIBTEX = `@article{10.1145/3831299,
author = {Valente, Andreia and Kothari, Nidhi and Ahmed-Mahmoud, Hana and Esteves, Augusto and Billinghurst, Mark},
title = {The Balance Toolkit: Democratizing Balance-Based Interaction Through Open-Source Software for Repurposed Wii Balance Boards},
year = {2026},
issue_date = {November 2026},
publisher = {Association for Computing Machinery},
address = {New York, NY, USA},
volume = {10},
number = {7},
url = {https://doi.org/10.1145/3831299},
doi = {10.1145/3831299},
journal = {Proc. ACM Hum.-Comput. Interact.},
month = nov,
articleno = {GAMES067},
numpages = {31},
keywords = {${KEYWORDS.join(", ")}}
}`;

// The same record as the BibTeX, for reference managers that import RIS (Zotero, EndNote,
// Mendeley). RIS lines end in CRLF and the record closes with "ER  - ".
export const CITATION_RIS = [
  "TY  - JOUR",
  "AU  - Valente, Andreia",
  "AU  - Kothari, Nidhi",
  "AU  - Ahmed-Mahmoud, Hana",
  "AU  - Esteves, Augusto",
  "AU  - Billinghurst, Mark",
  "TI  - The Balance Toolkit: Democratizing Balance-Based Interaction Through Open-Source Software for Repurposed Wii Balance Boards",
  "T2  - Proceedings of the ACM on Human-Computer Interaction",
  "J2  - Proc. ACM Hum.-Comput. Interact.",
  "PY  - 2026",
  "DA  - 2026/11",
  "VL  - 10",
  "IS  - 7",
  "C7  - GAMES067",
  "SP  - 1",
  "EP  - 31",
  "PB  - Association for Computing Machinery",
  "CY  - New York, NY, USA",
  "DO  - 10.1145/3831299",
  "UR  - https://doi.org/10.1145/3831299",
  ...KEYWORDS.map((keyword) => `KW  - ${keyword}`),
  "ER  - ",
  "",
].join("\r\n");
