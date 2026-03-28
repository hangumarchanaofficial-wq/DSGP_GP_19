console.log("Background script started");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    
        if (!sender.tab) return; // safety check 
    
        if (message.type === "PAGE_QUICK_INFO") {
            console.log("Quick info received:", message.title);
            return;
        }

        if (message.type === "PAGE_FULL_CONTENT") {

        console.log("Full content received, sending to backend...");
        fetch("http://127.0.0.1:5000/check_content",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify(
                {
                    title:message.title,
                    url: message.url,
                    content: message.content
                }
            ) 
        })

        .then(res=>res.json())
        .then(data => {
            console.log("Decision from backend:", data);

            if (data.result === "pending") {
                console.log("Waiting for more data...");
                return;
            }

            if (data.result === "block") {

                chrome.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: () => {

                            // Preventing duplicate overlays
                            if (document.getElementById("block-overlay")) return;

                            let overlay = document.createElement("div");
                            overlay.id = "block-overlay";

                            overlay.style.position = "fixed";
                            overlay.style.top = "0";
                            overlay.style.left = "0";
                            overlay.style.width = "100%";
                            overlay.style.height = "100%";
                            overlay.style.backgroundColor = "#ffffff";
                            overlay.style.zIndex = "999999999";
                            overlay.style.display = "flex";
                            overlay.style.justifyContent = "center";
                            overlay.style.alignItems = "center";
                            overlay.style.textAlign = "center";
                            overlay.style.fontFamily = "sans-serif";

                            overlay.innerHTML = `
                                <div>
                                    <h1 style="color:red;">🚫 Page Blocked</h1>
                                    <p>This content is classified as non-educational.</p>
                                </div>
                            `;

                            document.body.appendChild(overlay);
                        }
                });

        }
    })
    .catch(err => console.error("Error:", err));

}

});
