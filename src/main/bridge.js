const { clipboard, ipcMain, BrowserWindow, session } = require("electron");
const path = require("path");
const fetch = require("electron-fetch").default;
const { getUrl, deleteData } = require("./getData");

const user_agent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36";

// 內部驗證函數
const validateToken = async (loginToken, provider) => {
  const url = `https://as.${provider}.com/user/oauth2/v2/grant`;
  const appCode = provider === "gryphline"
    ? "3dacefa138426cfe"
    : "be36d44aa36bfb5b";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": user_agent,
      },
      body: JSON.stringify({
        token: String(loginToken || "").trim(),
        appCode: appCode,
        type: 1,
      }),
    });
    const resData = await response.json();
    return (resData.status === 0 && resData.data && resData.data.token)
      ? resData.data.token
      : null;
  } catch (e) {
    return null;
  }
};

ipcMain.handle("GET_OAUTH_TOKEN", async (event, { loginToken, provider }) => {
  return await validateToken(loginToken, provider);
});

ipcMain.handle("VALIDATE_ACCOUNT_TOKEN", async (event, { token, provider }) => {
  const result = await validateToken(token, provider);
  return result !== null;
});

ipcMain.handle(
  "FETCH_UID_BY_TOKEN",
  async (event, { oauthToken, provider }) => {
    if (!oauthToken || typeof oauthToken !== "string") {
      console.error(
        "FETCH_UID_BY_TOKEN: Invalid oauthToken type:",
        typeof oauthToken,
      );
      return null;
    }
    const cleanToken = oauthToken.trim();
    if (cleanToken.length < 10) {
      console.error("FETCH_UID_BY_TOKEN: Token too short:", cleanToken.length);
      return null;
    }

    const maskedToken = `${cleanToken.substring(0, 5)}...${
      cleanToken.substring(cleanToken.length - 5)
    }`;
    console.log(
      `[Auth] Fetching bindings. Token: ${maskedToken} Len: ${cleanToken.length} Provider: ${provider}`,
    );

    let url =
      `https://binding-api-account-prod.${provider}.com/account/binding/v1/binding_list?token=${
        encodeURIComponent(cleanToken)
      }&appCode=endfield`;
    try {
      let response = await fetch(url, {
        headers: { "User-Agent": user_agent },
      });
      let resData = await response.json();

      // Fallback: Try Capital 'Token' if lowercase 'token' fails with base64 validation error
      if (
        resData.status !== 0 && resData.msg && resData.msg.includes("base64")
      ) {
        console.log(
          "Lowercase 'token' failed base64 validation. Trying Capital 'Token'...",
        );
        url =
          `https://binding-api-account-prod.${provider}.com/account/binding/v1/binding_list?Token=${
            encodeURIComponent(cleanToken)
          }&appCode=endfield`;
        response = await fetch(url, {
          headers: { "User-Agent": user_agent },
        });
        resData = await response.json();
      }

      if (resData.status !== 0) {
        console.error(
          "Binding API returned error status:",
          JSON.stringify(resData),
        );
        // Special diagnostic for base64 validation error
        if (resData.msg && resData.msg.includes("base64")) {
          console.log(
            "INTERNAL ERROR: Token failed base64 validation. Checking characters...",
          );
          const invalidChars = cleanToken.match(/[^a-zA-Z0-9+/=]/g);
          if (invalidChars) {
            console.log("Token contains non-base64 characters:", [
              ...new Set(invalidChars),
            ]);
          } else {
            console.log(
              "Token ONLY contains base64 characters. Potential length/padding issue?",
            );
          }
        }
        return null;
      }

      const list = resData.data.list || [];
      const appNames = list.map((x) => x.appName || x.appCode);
      console.log("Found games in account:", appNames);

      let appInfo = list.find((x) =>
        String(x.appCode).toLowerCase().includes("endfield")
      );

      if (!appInfo && list.length > 0) {
        console.log(
          "No Endfield appCode match, falling back to first app with bindings.",
        );
        appInfo = list.find((x) => x.bindingList && x.bindingList.length > 0);
      }

      if (!appInfo) {
        console.log(
          "[Auth] No matching app found in account bindings.",
        );
        return { ok: false, reason: "NO_GAME" };
      }

      const appName = appInfo.appName || appInfo.appCode || "Unknown";
      const bindings = appInfo.bindingList || [];

      if (!bindings.length) {
        console.log(
          `[Auth] Game "${appName}" found but bindingList is empty.`,
        );
        return { ok: false, reason: "NO_BINDINGS", appName };
      }

      console.log(`[Auth] Found ${bindings.length} binding(s) for "${appName}":`);
      const result = [];
      for (const binding of bindings) {
        if (!binding.uid) {
          console.log("  - Binding missing uid, skipping.");
          continue;
        }
        const roles = (binding.roles || []).map((role) => ({
          serverId: String(role.serverId || ""),
          serverName: String(role.serverName || ""),
          nickName: String(role.nickName || ""),
          roleId: String(role.roleId || ""),
        }));
        console.log(`  - uid: ${binding.uid}, roles: ${roles.length}`);
        result.push({ uid: binding.uid, roles });
      }

      if (result.length === 0) {
        console.log(
          `[Auth] Bindings exist for "${appName}" but no valid entries with uid/roles.`,
        );
        return { ok: false, reason: "NO_ROLES", appName };
      }

      const totalRoles = result.reduce((sum, b) => sum + b.roles.length, 0);
      if (totalRoles === 0) {
        console.log(
          `[Auth] Bindings exist for "${appName}" but all have empty roles.`,
        );
        return { ok: false, reason: "NO_ROLES", appName };
      }

      console.log(`[Auth] Returning ${result.length} binding(s) with roles.`);
      return { ok: true, bindings: result };
    } catch (e) {
      console.error("Fetch UID Error:", e.message);
      return null;
    }
  },
);

ipcMain.handle(
  "GET_U8_TOKEN_BY_UID",
  async (event, { uid, oauthToken, provider }) => {
    const url =
      `https://binding-api-account-prod.${provider}.com/account/binding/v1/u8_token_by_uid`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": user_agent,
        },
        body: JSON.stringify({
          uid: uid,
          token: oauthToken,
        }),
      });
      const resData = await response.json();
      if (resData.status === 0 && resData.data && resData.data.token) {
        return resData.data.token;
      }
      console.error("GET_U8_TOKEN_BY_UID Error:", resData);
      return null;
    } catch (e) {
      console.error("GET_U8_TOKEN_BY_UID Exception:", e.message);
      return null;
    }
  },
);

ipcMain.handle("COPY_URL", async () => {
  const url = await getUrl();
  if (url) {
    clipboard.writeText(url);
    return true;
  }
  return false;
});

ipcMain.handle("DELETE_DATA", async (event, uid, action) => {
  await deleteData(uid, action);
});

ipcMain.handle("OPEN_LOGIN_WINDOW", async (event, provider, options = {}) => {
  if (options.forceFresh) {
    const ses = session.fromPartition("persist:hg-login");
    await ses.clearStorageData();
    await ses.clearCache();
    console.log("[Auth] Forced fresh login session.");
  }

  const url = provider === "gryphline"
    ? "https://user.gryphline.com/"
    : "https://user.hypergryph.com/";
  const pollUrlPattern = provider === "gryphline"
    ? "*://web-api.gryphline.com/cookie_store/account_token*"
    : "*://web-api.hypergryph.com/account/info/hg*";
  const pollUrl = provider === "gryphline"
    ? "https://web-api.gryphline.com/cookie_store/account_token"
    : "https://web-api.hypergryph.com/account/info/hg";

  let loginWin = new BrowserWindow({
    width: 500,
    height: 700,
    resizable: false,
    title: provider === "gryphline"
      ? "登录鹰角通行证（国际服）"
      : "登录鹰角通行证",
    webPreferences: {
      preload: path.join(__dirname, "preload-login.js"),
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:hg-login",
    },
  });

  loginWin.setMenuBarVisibility(false);
  const ses = loginWin.webContents.session;

  return new Promise((resolve) => {
    let handled = false;

    const finish = async (token) => {
      if (handled || !token) return;

      // [關鍵] 在視窗關閉前先驗證 Token 有效性
      const isValid = await validateToken(token, provider);
      if (!isValid) {
        console.log("Captured token is invalid or expired, ignoring...");
        return;
      }

      handled = true;
      ses.webRequest.onCompleted({ urls: [pollUrlPattern] }, null);
      
      if (loginWin) {
        loginWin.close();
        loginWin = null;
      }
      resolve(token);
    };

    const onHgLoginSuccess = (e, token) => {
      if (token) finish(token);
    };
    ipcMain.on("HG_LOGIN_SUCCESS", onHgLoginSuccess);

    const pollInterval = setInterval(async () => {
      if (handled || !loginWin || loginWin.isDestroyed()) return;
      try {
        const token = await loginWin.webContents.executeJavaScript(`
          (function() {
            return fetch("${pollUrl}", { credentials: "include" })
              .then(res => res.json())
              .then(data => {
                if (data.code === 0 && data.data && data.data.content) return data.data.content;
                if (data.status === 0 && data.data && data.data.token) return data.data.token;
                return null;
              })
              .catch(() => null);
          })()
        `);
        if (token) finish(token);
      } catch (e) {}
    }, 2000);

    ses.webRequest.onCompleted({ urls: [pollUrlPattern] }, async (details) => {
      if (handled || details.statusCode !== 200) return;
      try {
        const token = await loginWin.webContents.executeJavaScript(`
          fetch("${details.url}", { credentials: "include" })
            .then(res => res.json())
            .then(data => {
              if ((data.code === 0 && data.data && data.data.content) || (data.status === 0 && data.data && data.data.token)) {
                return data.data.content || data.data.token;
              }
              return null;
            })
            .catch(() => null)
        `);
        if (token) finish(token);
      } catch (e) {}
    });

    loginWin.on("closed", () => {
      clearInterval(pollInterval);
      ipcMain.removeListener("HG_LOGIN_SUCCESS", onHgLoginSuccess);
      if (!handled) {
        handled = true;
        ses.webRequest.onCompleted({ urls: [pollUrlPattern] }, null);
        loginWin = null;
        resolve(null);
      }
    });

    loginWin.loadURL(url);
  });
});

ipcMain.handle("AUTO_GET_TOKEN", async (event, provider) => {
  const url = provider === "gryphline"
    ? "https://user.gryphline.com/"
    : "https://user.hypergryph.com/";

  const pollUrl = provider === "gryphline"
    ? "https://web-api.gryphline.com/cookie_store/account_token"
    : "https://web-api.hypergryph.com/account/info/hg";

  const tempWin = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: "persist:hg-login",
    },
  });

  try {
    await tempWin.loadURL(url);
    // Add a race with a timeout
    const result = await Promise.race([
      tempWin.webContents.executeJavaScript(`
        fetch("${pollUrl}", { method: "GET", credentials: "include" })
          .then(res => res.json())
          .then(data => {
            if (data.code === 0 && data.data && data.data.content) return data.data.content;
            if (data.status === 0 && data.data && data.data.token) return data.data.token;
            return null;
          })
          .catch(() => null)
      `),
      new Promise((r) => setTimeout(() => r(null), 10000)),
    ]);
    tempWin.close();
    return result;
  } catch (e) {
    console.error("AUTO_GET_TOKEN Error:", e);
    if (!tempWin.isDestroyed()) tempWin.close();
    return null;
  }
});

ipcMain.handle("CLEAR_LOGIN_SESSION", async () => {
  const ses = session.fromPartition("persist:hg-login");
  await ses.clearStorageData();
  await ses.clearCache();
  console.log("[Auth] Login session cleared.");
  return true;
});
