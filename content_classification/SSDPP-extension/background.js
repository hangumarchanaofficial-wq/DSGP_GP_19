const API_URL = "http://127.0.0.1:5000/api/content/check";

console.log("Background script started");

function applyOverlay(tabId, blocked, reason = "This page was classified as non-educational by SDPPS.") {
    chrome.scripting.executeScript({
        target: { tabId },
        func: (shouldBlock, message) => {
            const existing = document.getElementById("block-overlay");

            if (!shouldBlock) {
                if (existing) existing.remove();
                return;
            }

            if (existing) return;

            const overlay = document.createElement("div");
            overlay.id = "block-overlay";
            overlay.setAttribute("role", "dialog");
            overlay.setAttribute("aria-modal", "true");
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                z-index: 999999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 32px;
                overflow: hidden;
                color: #f8fafc;
                background:
                    radial-gradient(circle at 20% 20%, rgba(249, 115, 22, 0.22), transparent 30%),
                    radial-gradient(circle at 80% 18%, rgba(251, 113, 133, 0.16), transparent 24%),
                    radial-gradient(circle at 50% 82%, rgba(56, 189, 248, 0.14), transparent 28%),
                    rgba(4, 8, 20, 0.92);
                backdrop-filter: blur(18px) saturate(115%);
                font-family: "Segoe UI Variable Display", "SF Pro Display", "Inter", "Segoe UI", sans-serif;
            `;

            const style = document.createElement("style");
            style.textContent = `
                #block-overlay * {
                    box-sizing: border-box;
                }

                #block-overlay .sdpps-shell {
                    position: relative;
                    width: min(100%, 980px);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 28px;
                    overflow: hidden;
                    background:
                        linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(8, 15, 30, 0.78)),
                        rgba(15, 23, 42, 0.76);
                    box-shadow:
                        0 30px 80px rgba(0, 0, 0, 0.45),
                        inset 0 1px 0 rgba(255, 255, 255, 0.08);
                }

                #block-overlay .sdpps-grid {
                    display: grid;
                    grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
                    min-height: 520px;
                }

                #block-overlay .sdpps-main {
                    position: relative;
                    padding: 56px;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 32px;
                }

                #block-overlay .sdpps-panel {
                    position: relative;
                    padding: 56px 40px;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
                    border-left: 1px solid rgba(255, 255, 255, 0.08);
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    gap: 28px;
                }

                #block-overlay .sdpps-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 10px;
                    width: fit-content;
                    padding: 8px 14px;
                    border: 1px solid rgba(248, 113, 113, 0.25);
                    border-radius: 999px;
                    background: rgba(248, 113, 113, 0.08);
                    color: #fecaca;
                    font-size: 12px;
                    font-weight: 700;
                    letter-spacing: 0.18em;
                    text-transform: uppercase;
                }

                #block-overlay .sdpps-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 999px;
                    background: linear-gradient(135deg, #fb7185, #f97316);
                    box-shadow: 0 0 20px rgba(251, 113, 133, 0.85);
                }

                #block-overlay .sdpps-brand {
                    font-size: 13px;
                    letter-spacing: 0.28em;
                    text-transform: uppercase;
                    color: rgba(226, 232, 240, 0.76);
                }

                #block-overlay .sdpps-title {
                    margin: 0;
                    max-width: 10ch;
                    font-size: clamp(44px, 6vw, 84px);
                    line-height: 0.94;
                    letter-spacing: -0.05em;
                    color: #ffffff;
                }

                #block-overlay .sdpps-copy {
                    max-width: 560px;
                    margin: 0;
                    font-size: 18px;
                    line-height: 1.7;
                    color: rgba(226, 232, 240, 0.78);
                }

                #block-overlay .sdpps-actions {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 14px;
                }

                #block-overlay .sdpps-button,
                #block-overlay .sdpps-button-secondary {
                    appearance: none;
                    border: 0;
                    border-radius: 999px;
                    padding: 14px 22px;
                    font: inherit;
                    font-weight: 700;
                    cursor: pointer;
                    transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease;
                }

                #block-overlay .sdpps-button {
                    color: #fff7ed;
                    background: linear-gradient(135deg, #f97316, #fb7185);
                    box-shadow: 0 18px 36px rgba(249, 115, 22, 0.3);
                }

                #block-overlay .sdpps-button-secondary {
                    color: #e2e8f0;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                }

                #block-overlay .sdpps-button:hover,
                #block-overlay .sdpps-button-secondary:hover {
                    transform: translateY(-1px);
                }

                #block-overlay .sdpps-metric {
                    display: grid;
                    gap: 16px;
                }

                #block-overlay .sdpps-card {
                    padding: 18px 20px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                    background: rgba(255, 255, 255, 0.04);
                }

                #block-overlay .sdpps-card-label {
                    margin: 0 0 8px;
                    font-size: 12px;
                    letter-spacing: 0.14em;
                    text-transform: uppercase;
                    color: rgba(148, 163, 184, 0.9);
                }

                #block-overlay .sdpps-card-value {
                    margin: 0;
                    font-size: 22px;
                    line-height: 1.35;
                    color: #f8fafc;
                }

                #block-overlay .sdpps-card-copy {
                    margin: 0;
                    font-size: 14px;
                    line-height: 1.6;
                    color: rgba(203, 213, 225, 0.75);
                }

                #block-overlay .sdpps-orb {
                    position: absolute;
                    border-radius: 999px;
                    filter: blur(0);
                    opacity: 0.6;
                    pointer-events: none;
                    animation: sdppsFloat 10s ease-in-out infinite;
                }

                #block-overlay .sdpps-orb-one {
                    top: -120px;
                    left: -40px;
                    width: 260px;
                    height: 260px;
                    background: radial-gradient(circle, rgba(249, 115, 22, 0.25), transparent 68%);
                }

                #block-overlay .sdpps-orb-two {
                    right: -70px;
                    bottom: -80px;
                    width: 240px;
                    height: 240px;
                    background: radial-gradient(circle, rgba(56, 189, 248, 0.18), transparent 68%);
                    animation-delay: -4s;
                }

                @keyframes sdppsFloat {
                    0%, 100% {
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                    50% {
                        transform: translate3d(0, -14px, 0) scale(1.04);
                    }
                }

                @media (max-width: 860px) {
                    #block-overlay {
                        padding: 18px;
                    }

                    #block-overlay .sdpps-grid {
                        grid-template-columns: 1fr;
                    }

                    #block-overlay .sdpps-main,
                    #block-overlay .sdpps-panel {
                        padding: 30px 24px;
                    }

                    #block-overlay .sdpps-panel {
                        border-left: 0;
                        border-top: 1px solid rgba(255, 255, 255, 0.08);
                    }

                    #block-overlay .sdpps-title {
                        max-width: none;
                        font-size: clamp(36px, 10vw, 56px);
                    }

                    #block-overlay .sdpps-copy {
                        font-size: 16px;
                    }
                }
            `;

            const hostname = window.location.hostname.replace(/^www\./, "") || "this page";

            overlay.innerHTML = `
                <div class="sdpps-shell">
                    <div class="sdpps-orb sdpps-orb-one"></div>
                    <div class="sdpps-orb sdpps-orb-two"></div>
                    <div class="sdpps-grid">
                        <section class="sdpps-main">
                            <div>
                                <div class="sdpps-badge">
                                    <span class="sdpps-dot"></span>
                                    Focus shield active
                                </div>
                            </div>

                            <div>
                                <div class="sdpps-brand">SDPPS protection layer</div>
                                <h1 class="sdpps-title">Page blocked.</h1>
                                <p class="sdpps-copy"></p>
                            </div>

                            <div class="sdpps-actions">
                                <button class="sdpps-button" type="button">Go back</button>
                                <button class="sdpps-button-secondary" type="button">Dismiss tab</button>
                            </div>
                        </section>

                        <aside class="sdpps-panel">
                            <div class="sdpps-metric">
                                <div class="sdpps-card">
                                    <p class="sdpps-card-label">Classification</p>
                                    <p class="sdpps-card-value">Non-educational content detected</p>
                                </div>
                                <div class="sdpps-card">
                                    <p class="sdpps-card-label">Source</p>
                                    <p class="sdpps-card-value">${hostname}</p>
                                </div>
                            </div>

                            <div class="sdpps-card">
                                <p class="sdpps-card-label">Why this happened</p>
                                <p class="sdpps-card-copy">SDPPS is preserving your study session by covering content that falls outside your current focus rules.</p>
                            </div>
                        </aside>
                    </div>
                </div>
            `;

            const copy = overlay.querySelector(".sdpps-copy");
            if (copy) {
                copy.textContent = message;
            }

            const primaryButton = overlay.querySelector(".sdpps-button");
            if (primaryButton) {
                primaryButton.addEventListener("click", () => {
                    if (window.history.length > 1) {
                        window.history.back();
                        return;
                    }
                    window.location.replace("about:blank");
                });
            }

            const secondaryButton = overlay.querySelector(".sdpps-button-secondary");
            if (secondaryButton) {
                secondaryButton.addEventListener("click", () => {
                    window.location.replace("about:blank");
                });
            }

            overlay.appendChild(style);
            document.body.appendChild(overlay);
        },
        args: [blocked, reason],
    });
}

chrome.runtime.onMessage.addListener((message, sender) => {
    if (!sender.tab?.id) return;
    if (message.type !== "PAGE_FULL_CONTENT") return;

    fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            title: message.title,
            url: message.url,
            content: message.content,
        }),
    })
        .then(async (res) => {
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Classification request failed");
            }
            return data;
        })
        .then((data) => {
            console.log("Decision from backend:", data);

            if (data.result === "block") {
                applyOverlay(sender.tab.id, true);
                return;
            }

            applyOverlay(sender.tab.id, false);
        })
        .catch((err) => {
            console.error("Classifier request failed:", err);
            applyOverlay(sender.tab.id, false);
        });
});
