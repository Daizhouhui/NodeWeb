      (() => {
        const themeStylesheet = document.getElementById(
          "darkThemeStylesheet",
        );
        const appConfig = window.NODE_WEB_CONFIG || {};
        const themeConfig = appConfig.theme || {};
        const themes = Array.isArray(themeConfig.list) ? themeConfig.list : [];
        const supportedThemes = themes.map((item) => item.id);
        // theme.default 使用 1 起始的序号，对应 theme.list 中的顺序
        const configuredDefaultTheme = themes[Number(themeConfig.default) - 1];
        let theme = "style3";

        if (configuredDefaultTheme) {
          theme = configuredDefaultTheme.id;
        } else {
          console.warn(
            "默认主题配置无效，请在 config.js 的 theme.default 中设置 1 到 6",
          );
        }

        try {
          const savedTheme = localStorage.getItem(
            themeConfig.storageKey || "vless-node-theme-v2",
          );
          if (supportedThemes.includes(savedTheme)) {
            theme = savedTheme;
          }
        } catch (error) {
          console.warn("读取主题偏好失败", error);
        }

        const activeTheme = themes.find((item) => item.id === theme);
        document.documentElement.dataset.theme = theme;
        document.documentElement.classList.toggle(
          "show-merged-upload-buttons",
          Boolean(
            appConfig.ui && appConfig.ui.showMergedSubscriptionUploadButtons,
          ),
        );
        themeStylesheet.disabled = !(activeTheme && activeTheme.dark);
      })();
