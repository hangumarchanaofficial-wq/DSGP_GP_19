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
            overlay.style.position = "fixed";
            overlay.style.top = "0";
            overlay.style.left = "0";
            overlay.style.width = "100%";
            overlay.style.height = "100%";
            overlay.style.background = "rgba(10, 12, 20, 0.97)";
            overlay.style.color = "#f8fafc";
            overlay.style.zIndex = "999999999";
            overlay.style.display = "flex";
            overlay.style.justifyContent = "center";
            overlay.style.alignItems = "center";
            overlay.style.textAlign = "center";
            overlay.style.fontFamily = "Arial, sans-serif";

            overlay.innerHTML = `
                <div style="max-width: 560px; padding: 32px;">
                    <h1 style="color: #f87171; font-size: 32px; margin-bottom: 12px;">Page Blocked</h1>
                    <p style="font-size: 16px; line-height: 1.5; color: #cbd5e1;">${message}</p>
                </div>
            `;

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
