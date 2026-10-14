let mathWindowID = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "asleep") {
        if (mathWindowID !== null) {
            chrome.windows.update(mathWindowID, {
                focused: true
            })
            return;
        }
        console.log("User is asleep");
        chrome.windows.create (
            {
                url: chrome.runtime.getURL("index.html?mode=math"),
                type: "popup",
                width: 320,
                height: 390,
                focused: true
            },
            (window) => {
                if (window) mathWindowID = window.id;
            }
        )
    }

    if (msg.type === "stop alarm") {
        chrome.runtime.sendMessage({
            type: "alarm stopped"
        });
        if (mathWindowID !== null) {
            // const ID = mathWindowID;
            chrome.windows.remove(mathWindowID);
            mathWindowID = null;
        }
    }

    chrome.windows.onRemoved.addListener((windowID) => {
        if(windowID === mathWindowID) mathWindowID = null;
    })
})