let pageText = document.body.innerText;

chrome.runtime.sendMessage({
    type: "PAGE_DATA",
    title: document.title,
    url: window.location.href,
    content: pageText
});