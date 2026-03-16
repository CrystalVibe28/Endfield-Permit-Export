const user_agent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.112 Safari/537.36";

export const getOAuthToken = async (loginToken, provider) => {
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
                token: loginToken,
                appCode: appCode,
                type: 1,
            }),
        });

        if (!response.ok) {
            console.error("Grant API error:", response.status);
            return null;
        }

        const res = await response.json();
        if (res.status === 0 && res.data && res.data.token) {
            console.log("换取 OAuth Token 成功");
            return res.data.token;
        } else {
            console.error("Grant API 返回错误:", res);
            return null;
        }
    } catch (e) {
        console.error("Grant API Exception:", e);
        return null;
    }
};

export const fetchUidByToken = async (oauthToken, provider) => {
    const apiBaseUrl =
        `https://binding-api-account-prod.${provider}.com/account/binding/v1/binding_list`;
    const query = new URLSearchParams({
        token: oauthToken,
        appCode: "endfield",
    });

    try {
        const response = await fetch(`${apiBaseUrl}?${query.toString()}`, {
            method: "GET",
            headers: {
                "User-Agent": user_agent,
            },
        });

        if (!response.ok) return null;

        const data = await response.json();

        if (data.status !== 0) {
            console.error("获取 UID 失败:", data);
            return null;
        }

        const appInfo = data?.data?.list?.find((x) =>
            x.appCode === "endfield"
        ) || data?.data?.list?.[0];
        const bindings = appInfo?.bindingList || [];

        const result = [];
        for (const binding of bindings) {
            const uid = binding?.uid || "";
            if (!uid) continue;

            const roles = Array.isArray(binding?.roles)
                ? binding.roles.map((role) => ({
                    serverId: String(role?.serverId ?? ""),
                    serverName: String(role?.serverName ?? ""),
                    nickName: String(role?.nickName ?? ""),
                    roleId: String(role?.roleId ?? ""),
                }))
                : [];
            result.push({ uid, roles });
        }

        return result.length > 0 ? result : null;
    } catch (e) {
        console.error("Fetch UID Error", e);
        return null;
    }
};
