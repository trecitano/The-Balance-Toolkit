import { ReactNode, useState } from "react";
import clsx from "clsx";
import { openUrl } from "@tauri-apps/plugin-opener";
import acmLogo from "@/assets/acm-logo.svg";
import { Modal } from "@/components/Modal";
import PageSubtitle from "@/components/PageSubtitle.tsx";
import { ToolkitButton } from "@/components/ToolkitButton.tsx";
import { commands } from "@/utils/requests.ts";
import { HomeIcon, HomeIconName } from "@/pages/home/HomeIcons.tsx";
import { tile } from "@/pages/home/tile.ts";
import { usePageZoom } from "@/pages/home/ZoomToFill.tsx";
import {
  CITATION_APA,
  CITATION_BIBTEX,
  CITATION_RIS,
  documentationLinks,
  helpLinks,
  HomeLink,
  paperLink,
  resourceLinks,
} from "@/pages/home/links.ts";

// Each card has its own tint, so the three link cards read as separate groups at a glance.
const blue = "bg-(--primary-light) text-(--primary)";
const amber = "bg-(--accent-light) text-[#9a7a00]";
const red = "bg-(--red-light) text-(--red)";

// Links leave the app for the system browser or mail client. Outside Tauri, such as in a plain
// browser tab during development, fall back to a new tab.
async function openExternal(url: string) {
  try {
    await openUrl(url);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function linkProps(link: Pick<HomeLink, "label" | "url">, onCite?: () => void) {
  return {
    "aria-label": link.url ? `${link.label}, opens outside the app` : link.label,
    onClick: () => (link.url ? void openExternal(link.url) : onCite?.()),
  };
}

function Badge({ icon, tone, size }: { icon: HomeIconName; tone: string; size: string }) {
  return (
    <span className={clsx("flex shrink-0 items-center justify-center rounded-lg", size, tone)}>
      <HomeIcon name={icon} className="size-[55%]" />
    </span>
  );
}

function OutArrow({ className }: { className?: string }) {
  return (
    <HomeIcon
      name="external"
      className={clsx("size-4 shrink-0 text-gray-300 transition-colors group-hover:text-(--primary)", className)}
    />
  );
}

function LinkCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 p-(--space-sm)">
      <PageSubtitle>{title}</PageSubtitle>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

// Help Support Card: three tiles side by side.
export function HelpSupportCard() {
  return (
    <LinkCard title="Help and Support">
      <div className="grid grid-cols-3 gap-2">
        {helpLinks.map((link) => (
          <button
            type="button"
            key={link.label}
            {...linkProps(link)}
            className={clsx(tile, "flex-col items-center gap-2.5 bg-white px-2 py-4 text-center")}
          >
            <OutArrow className="absolute top-2 right-2" />
            <Badge icon={link.icon} tone={blue} size="size-10" />
            <span className="text-sm leading-tight font-semibold text-gray-900">{link.label}</span>
          </button>
        ))}
      </div>
    </LinkCard>
  );
}

// Documentation Card: a two-by-two grid of guides.
export function DocumentationCard() {
  return (
    <LinkCard title="Documentation">
      <div className="grid grid-cols-2 gap-2">
        {documentationLinks.map((link) => (
          <button
            type="button"
            key={link.label}
            {...linkProps(link)}
            className={clsx(tile, "items-center gap-2.5 bg-white p-2.5 text-left")}
          >
            <Badge icon={link.icon} tone={amber} size="size-8" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">{link.label}</span>
          </button>
        ))}
      </div>
    </LinkCard>
  );
}

// Other Resources Card: the paper as a featured tile, then smaller tiles for the rest.
export function OtherResourcesCard() {
  const [citing, setCiting] = useState(false);
  return (
    <LinkCard title="Other Resources">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          {...linkProps(paperLink)}
          className={clsx(tile, "items-center gap-3 bg-[#fff7f7] p-2.5 text-left")}
        >
          <img src={acmLogo} alt="ACM" className="size-9 shrink-0" draggable={false} />
          <span className="min-w-0 flex-1 text-sm font-semibold text-gray-900">{paperLink.label}</span>
          <span className="shrink-0 rounded-full bg-(--accent) px-2.5 py-1 text-[11px] font-semibold text-gray-900">
            Honorable Mention
          </span>
          <OutArrow />
        </button>
        <div className="grid grid-cols-4 gap-2">
          {resourceLinks.map((link) => (
            <button
              type="button"
              key={link.label}
              {...linkProps(link, () => setCiting(true))}
              className={clsx(tile, "flex-col items-center gap-1.5 bg-white px-1 py-2 text-center")}
            >
              <Badge icon={link.icon} tone={red} size="size-7" />
              <span className="text-xs font-semibold text-gray-800">{link.label}</span>
            </button>
          ))}
        </div>
      </div>
      <CitationModal open={citing} onClose={() => setCiting(false)} />
    </LinkCard>
  );
}

const CITATION_BLOCKS = [
  { label: "APA", text: CITATION_APA, rows: 4 },
  { label: "BibTeX", text: CITATION_BIBTEX, rows: 7 },
];

function CitationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Dialogs are drawn outside the page, so match the page's zoom here.
  const zoom = usePageZoom();
  const [status, setStatus] = useState("");
  // The save dialog doesn't block this window, so stop a second click from opening another one.
  const [saving, setSaving] = useState(false);
  const close = () => {
    setStatus("");
    onClose();
  };
  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`${label} copied.`);
    } catch {
      setStatus("Select the text and copy it with your keyboard.");
    }
  };
  const downloadRis = async () => {
    setSaving(true);
    try {
      const saved = await commands.files.saveCitation("valente2026balance.ris", CITATION_RIS);
      if (saved) setStatus("RIS file saved.");
    } catch (error) {
      setStatus(`Couldn't save the RIS file: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal open={open} label="Cite the paper" onClose={close} className="w-2xl text-gray-900" style={{ zoom }}>
      <h2 className="mb-4 text-lg font-bold">Cite The Balance Toolkit</h2>
      {CITATION_BLOCKS.map(({ label, text, rows }) => (
        <div key={label} className="mb-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-semibold">{label}</span>
            <ToolkitButton type="button" color="white" size="sm" onClick={() => void copy(label, text)}>
              Copy {label}
            </ToolkitButton>
          </div>
          <textarea
            readOnly
            aria-label={`${label} citation`}
            rows={rows}
            className="w-full resize-none rounded border border-gray-300 p-3 font-mono text-xs"
            value={text}
            onFocus={(event) => event.target.select()}
          />
        </div>
      ))}
      <p role="status" className="mb-3 min-h-5 text-sm">
        {status}
      </p>
      <div className="flex justify-center gap-3">
        <ToolkitButton type="button" color="blue" disabled={saving} onClick={() => void downloadRis()}>
          Download RIS
        </ToolkitButton>
        <ToolkitButton type="button" color="grey" onClick={close}>
          Close
        </ToolkitButton>
      </div>
    </Modal>
  );
}
