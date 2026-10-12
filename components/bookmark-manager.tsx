"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { AlertTriangle, ExternalLink, Globe2, Link2, Plus, Trash2, X } from "lucide-react";
import type { Bookmark } from "@/lib/personal-data";

type Props = {
  bookmarks: Bookmark[];
  onAdd: (bookmark: Bookmark) => void;
  onRemove: (id: string) => void;
};

function isLocalAddress(url: URL) {
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;

  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [first, second] = parts.map(Number);
    return first === 10
      || first === 127
      || first === 0
      || (first === 169 && second === 254)
      || (first === 172 && second >= 16 && second <= 31)
      || (first === 192 && second === 168)
      || (first === 100 && second >= 64 && second <= 127);
  }

  return host === "::1"
    || host.startsWith("fc")
    || host.startsWith("fd")
    || /^fe[89ab]/.test(host);
}

function BookmarkCard({ bookmark, onRemove }: { bookmark: Bookmark; onRemove: (id: string) => void }) {
  const [iconSourceIndex, setIconSourceIndex] = useState<number | null>(0);
  const [warningOpen, setWarningOpen] = useState(false);
  const parsedUrl = new URL(bookmark.url);
  const localAddress = isLocalAddress(parsedUrl);
  const iconSources = [
    `${parsedUrl.origin}/favicon.ico`,
    ...(!localAddress && parsedUrl.hostname.includes(".") && !parsedUrl.hostname.endsWith(".lan") && !parsedUrl.hostname.endsWith(".home.arpa")
      ? [`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(parsedUrl.origin)}&sz=64`]
      : []),
  ];

  function openBookmark() {
    if (!localAddress) return;
    setWarningOpen(true);
  }

  function continueToBookmark() {
    window.open(bookmark.url, "_blank", "noopener,noreferrer");
    setWarningOpen(false);
  }

  return (
    <>
      <article className="bookmark-card">
        <a
          className="bookmark-card-link"
          href={bookmark.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={localAddress ? (event) => { event.preventDefault(); openBookmark(); } : undefined}
          aria-label={localAddress ? `${bookmark.title}, lokal IP-adress, visa VPN-påminnelse` : `Öppna ${bookmark.title}`}
        >
          <span className="bookmark-card-icon">
            {iconSourceIndex !== null
              ? <Image
                  src={iconSources[iconSourceIndex]}
                  alt=""
                  width={25}
                  height={25}
                  unoptimized
                  onError={() => setIconSourceIndex((index) => index !== null && index + 1 < iconSources.length ? index + 1 : null)}
                />
              : <Globe2 size={24} aria-hidden="true" />}
          </span>
          <span className="bookmark-card-content">
            <strong>{bookmark.title}</strong>
            <small>{parsedUrl.hostname}</small>
          </span>
          <ExternalLink className="bookmark-open-icon" size={16} aria-hidden="true" />
        </a>
        <button className="bookmark-remove" type="button" aria-label={`Ta bort ${bookmark.title}`} onClick={() => onRemove(bookmark.id)}>
          <Trash2 size={15} />
        </button>
      </article>

      {warningOpen && (
        <div className="bookmark-vpn-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setWarningOpen(false); }}>
          <section
            className="bookmark-vpn-dialog widget"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`vpn-title-${bookmark.id}`}
            aria-describedby={`vpn-description-${bookmark.id}`}
          >
            <button className="bookmark-vpn-close" type="button" aria-label="Stäng påminnelsen" onClick={() => setWarningOpen(false)}>
              <X size={18} />
            </button>
            <span className="bookmark-vpn-icon"><AlertTriangle size={21} /></span>
            <h2 id={`vpn-title-${bookmark.id}`}>Lokal adress</h2>
            <p id={`vpn-description-${bookmark.id}`}>
              <strong>{bookmark.title}</strong> använder adressen <code>{parsedUrl.hostname}</code>. Om du inte är ansluten till ditt hemnätverk behöver du kanske aktivera VPN för att öppna sidan. Webbläsaren kan inte avgöra om VPN är anslutet.
            </p>
            <div className="bookmark-vpn-actions">
              <button className="secondary" type="button" onClick={() => setWarningOpen(false)}>Avbryt</button>
              <button className="primary" type="button" onClick={continueToBookmark}>Öppna ändå <ExternalLink size={15} /></button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export function BookmarkManager({ bookmarks, onAdd, onRemove }: Props) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      setError("Ange en giltig länk som börjar med https:// eller http://.");
      return;
    }

    if (!["https:", "http:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
      setError("Länken måste använda HTTP eller HTTPS och får inte innehålla inloggningsuppgifter.");
      return;
    }
    if (bookmarks.some((bookmark) => bookmark.url === parsedUrl.href)) {
      setError("Den länken finns redan på sidan.");
      return;
    }

    const label = title.trim() || parsedUrl.hostname;
    if (label.length > 100) {
      setError("Namnet får vara högst 100 tecken.");
      return;
    }

    onAdd({
      id: crypto.randomUUID(),
      title: label,
      url: parsedUrl.href,
      created: new Date().toISOString(),
    });
    setUrl("");
    setTitle("");
    setFormOpen(false);
  }

  return (
    <section className="bookmarks-page">
      <div className="bookmark-toolbar">
        <p className="muted">Dina sparade genvägar, samlade på ett ställe.</p>
        <button className="primary small" type="button" onClick={() => { setError(""); setFormOpen(true); }}>
          <Plus size={16} /> Lägg till länk
        </button>
      </div>

      {bookmarks.length > 0 ? (
        <div className="bookmark-grid">
          {bookmarks.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} onRemove={onRemove} />)}
        </div>
      ) : (
        <section className="widget bookmark-empty">
          <Link2 size={26} />
          <h2>Dina länkar visas här</h2>
          <p className="muted">Lägg till dina viktigaste webbplatser så skapas klickbara kort med sidans favicon.</p>
          <button className="primary small" type="button" onClick={() => { setError(""); setFormOpen(true); }}><Plus size={15} /> Lägg till länk</button>
        </section>
      )}

      {formOpen && (
        <div className="bookmark-vpn-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFormOpen(false); }}>
          <section className="bookmark-add-dialog widget" role="dialog" aria-modal="true" aria-labelledby="bookmark-add-title">
            <button className="bookmark-vpn-close" type="button" aria-label="Stäng formuläret" onClick={() => setFormOpen(false)}><X size={18} /></button>
            <div className="bookmark-add-heading">
              <span className="bookmark-add-icon"><Link2 size={19} /></span>
              <div><h2 id="bookmark-add-title">Lägg till en genväg</h2><p className="muted">Spara en webbplats för att snabbt hitta tillbaka.</p></div>
            </div>
            <form onSubmit={submit}>
              <div className="bookmark-form">
                <label>
                  Länk
                  <input autoFocus type="url" required maxLength={2048} placeholder="https://exempel.se" value={url} onChange={(event) => setUrl(event.target.value)} />
                </label>
                <label>
                  Namn <span className="muted">· valfritt</span>
                  <input maxLength={100} placeholder="Hämtas från adressen om du lämnar tomt" value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <button className="primary" type="submit"><Plus size={16} /> Lägg till länk</button>
              </div>
              {error && <p className="bookmark-error" role="alert">{error}</p>}
              <p className="bookmark-privacy">Ikonen hämtas först från webbplatsens <code>/favicon.ico</code>. För publika webbplatser används Googles ikontjänst som reserv. Privata adresser skickas inte dit. Länkar sparas lokalt i den här webbläsaren.</p>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
