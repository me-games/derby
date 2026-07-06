const FONT = "'Segoe UI', Arial, sans-serif";

function styled(tag: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement(tag) as HTMLDivElement;
  Object.assign(el.style, style);
  return el;
}

export class Hud {
  readonly loadingEl: HTMLDivElement;
  private readonly loadingText: HTMLDivElement;
  readonly bannerEl: HTMLDivElement;
  readonly overlayEl: HTMLDivElement;
  private readonly overlayTitle: HTMLDivElement;
  private readonly overlaySubtitle: HTMLDivElement;
  private readonly overlayButton: HTMLButtonElement;
  readonly racersEl: HTMLDivElement;

  constructor() {
    this.loadingEl = styled("div", {
      position: "fixed",
      inset: "0",
      background: "#080a14",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      fontSize: "20px",
      letterSpacing: "0.02em",
      zIndex: "50",
    });
    this.loadingText = styled("div", {});
    this.loadingText.textContent = "Loading…";
    this.loadingEl.appendChild(this.loadingText);
    document.body.appendChild(this.loadingEl);

    this.bannerEl = styled("div", {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(10,10,20,0.65)",
      color: "#fff",
      fontFamily: FONT,
      fontSize: "15px",
      padding: "8px 18px",
      borderRadius: "999px",
      zIndex: "20",
      display: "none",
      textAlign: "center",
    });
    document.body.appendChild(this.bannerEl);

    this.racersEl = styled("div", {
      position: "fixed",
      top: "16px",
      right: "16px",
      background: "rgba(10,10,20,0.55)",
      color: "#fff",
      fontFamily: FONT,
      fontSize: "14px",
      padding: "8px 14px",
      borderRadius: "10px",
      zIndex: "20",
      display: "none",
    });
    document.body.appendChild(this.racersEl);

    this.overlayEl = styled("div", {
      position: "fixed",
      inset: "0",
      background: "rgba(6,6,14,0.72)",
      color: "#fff",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      fontFamily: FONT,
      zIndex: "30",
      textAlign: "center",
      gap: "14px",
    });
    this.overlayTitle = styled("div", { fontSize: "40px", fontWeight: "700" });
    this.overlaySubtitle = styled("div", { fontSize: "17px", opacity: "0.85" });
    this.overlayButton = document.createElement("button");
    Object.assign(this.overlayButton.style, {
      marginTop: "10px",
      padding: "12px 28px",
      fontSize: "16px",
      fontFamily: FONT,
      fontWeight: "600",
      color: "#fff",
      background: "#ff5b3d",
      border: "none",
      borderRadius: "999px",
      cursor: "pointer",
    } as Partial<CSSStyleDeclaration>);
    this.overlayButton.style.display = "none";

    this.overlayEl.appendChild(this.overlayTitle);
    this.overlayEl.appendChild(this.overlaySubtitle);
    this.overlayEl.appendChild(this.overlayButton);
    document.body.appendChild(this.overlayEl);
  }

  setLoading(text: string): void {
    this.loadingText.textContent = text;
  }

  hideLoading(): void {
    this.loadingEl.style.display = "none";
  }

  setBanner(text: string | null): void {
    if (!text) {
      this.bannerEl.style.display = "none";
      return;
    }
    this.bannerEl.textContent = text;
    this.bannerEl.style.display = "block";
  }

  setRacers(text: string | null): void {
    if (!text) {
      this.racersEl.style.display = "none";
      return;
    }
    this.racersEl.textContent = text;
    this.racersEl.style.display = "block";
  }

  showOverlay(title: string, subtitle: string, onRetry?: () => void): void {
    this.overlayTitle.textContent = title;
    this.overlaySubtitle.textContent = subtitle;
    if (onRetry) {
      this.overlayButton.textContent = "Play Again";
      this.overlayButton.style.display = "inline-block";
      this.overlayButton.onclick = onRetry;
    } else {
      this.overlayButton.style.display = "none";
      this.overlayButton.onclick = null;
    }
    this.overlayEl.style.display = "flex";
  }

  hideOverlay(): void {
    this.overlayEl.style.display = "none";
  }
}
