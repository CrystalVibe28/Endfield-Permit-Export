const { ipcRenderer } = require("electron");

let hasSent = false;

function sendToken(token) {
    if (!token) return;
    ipcRenderer.send("HG_LOGIN_SUCCESS", token);
}

// Strategy 1: Intercept XHR
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", function () {
        if (!this._url) return;
        try {
            if (
                this._url.includes("grant") || this._url.includes("auth") ||
                this._url.includes("account/info/hg")
            ) {
                const res = JSON.parse(this.responseText);
                const token = (res.data && res.data.token) ||
                    (res.status === 0 && res.data && res.data.token) ||
                    (res.code === 0 && res.data && res.data.content);
                if (token) sendToken(token);
            }
        } catch (e) {}
    });
    return originalSend.apply(this, arguments);
};

// Strategy 2: Intercept Fetch
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const res = await originalFetch(...args);
    try {
        const url = typeof args[0] === "string" ? args[0] : args[0].url;
        if (
            url &&
            (url.includes("grant") || url.includes("auth") ||
                url.includes("account/info/hg"))
        ) {
            const clone = res.clone();
            clone.json().then((data) => {
                const token = (data.data && data.data.token) ||
                    (data.status === 0 && data.data && data.data.token) ||
                    (data.code === 0 && data.data && data.data.content);
                if (token) sendToken(token);
            }).catch(() => {});
        }
    } catch (e) {}
    return res;
};

// Strategy 3: Polling
const provider = window.location.host.includes("gryphline")
    ? "gryphline"
    : "hypergryph";
const pollUrl = provider === "gryphline"
    ? "https://web-api.gryphline.com/cookie_store/account_token"
    : "https://web-api.hypergryph.com/account/info/hg";

setInterval(() => {
    fetch(pollUrl, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => {
            const token = (data.code === 0 && data.data && data.data.content) ||
                (data.status === 0 && data.data && data.data.token);
            if (token) sendToken(token);
        })
        .catch(() => {});
}, 1000);
