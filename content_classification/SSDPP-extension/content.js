let lastSentSignature = "";
let currentUrl = window.location.href;
let sendTimer = null;

function removeExistingOverlay() {
    const overlay = document.getElementById("block-overlay");
    if (overlay) {
        overlay.remove();
    }
}

function collectPageContent() {
    const pageText = (document.body?.innerText || "").trim().slice(0, 6000);
    const payload = {
        type: "PAGE_FULL_CONTENT",
        title: document.title,
        url: window.location.href,
        content: pageText,
    };

    const signature = `${payload.url}|${payload.title}|${payload.content.slice(0, 500)}`;
    if (signature === lastSentSignature) {
        return;
    }

    lastSentSignature = signature;
    chrome.runtime.sendMessage(payload);
}

function scheduleCollect(delay = 700) {
    window.clearTimeout(sendTimer);
    sendTimer = window.setTimeout(() => {
        collectPageContent();
    }, delay);
}

function handleUrlChange() {
    if (window.location.href === currentUrl) {
        return;
    }
    currentUrl = window.location.href;
    lastSentSignature = "";
    removeExistingOverlay();
    scheduleCollect(1200);
}

function patchHistoryMethod(name) {
    const original = history[name];
    history[name] = function (...args) {
        const result = original.apply(this, args);
        handleUrlChange();
        return result;
    };
}

patchHistoryMethod("pushState");
patchHistoryMethod("replaceState");

window.addEventListener("popstate", () => handleUrlChange());
window.addEventListener("yt-navigate-finish", () => {
    currentUrl = window.location.href;
    lastSentSignature = "";
    removeExistingOverlay();
    scheduleCollect(1200);
});

const observer = new MutationObserver(() => {
    handleUrlChange();
    scheduleCollect(900);
});

function startObservers() {
    removeExistingOverlay();
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
    });
    scheduleCollect(1200);
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", startObservers, { once: true });
} else {
    startObservers();
}
