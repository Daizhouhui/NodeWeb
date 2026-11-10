      // 新增：全局通知函数
      function showNotification(title, message, type = "info") {
        const notificationId = "notification-" + Date.now();
        const notificationContainer = document.getElementById(
          "notificationContainer",
        );

        // 限制通知数量
        if (notifications.active.length >= notifications.maxNotifications) {
          const oldestNotification = document.getElementById(
            notifications.active[0],
          );
          if (oldestNotification) {
            oldestNotification.remove();
            notifications.active.shift();
          }
        }

        const notification = document.createElement("div");
        notification.id = notificationId;
        notification.className = `notification ${type}`;

        const time = new Date().toLocaleTimeString();

        notification.innerHTML = `
            <div class="notification-header">
                <div class="notification-title">${title}</div>
                <div class="notification-time">${time}</div>
                <button class="notification-close" onclick="closeNotification('${notificationId}')">&times;</button>
            </div>
            <div class="notification-message">${message}</div>
        `;

        notificationContainer.appendChild(notification);
        notifications.active.push(notificationId);

        // 自动关闭通知，各类型的显示时长由 config.js 配置
        const durationConfig =
          (getWebConfig().notifications || {}).durations || {};
        const timeoutDuration =
          Number(durationConfig[type]) ||
          Number(durationConfig.default) ||
          6000;
        setTimeout(() => {
          closeNotification(notificationId);
        }, timeoutDuration);
      }

      // 新增：关闭通知函数
      function closeNotification(id) {
        const notification = document.getElementById(id);
        if (notification) {
          notification.style.animation = "fadeOut 0.3s ease-out";
          setTimeout(() => {
            notification.remove();
            const index = notifications.active.indexOf(id);
            if (index > -1) {
              notifications.active.splice(index, 1);
            }
          }, 300);
        }
      }

      // 新增：添加日志函数
      function addLog(action, message, level = "info") {
        const time = new Date().toLocaleTimeString();
        const logEntry = {
          time,
          action,
          message,
          level,
          timestamp: Date.now(),
        };

        logData.entries.unshift(logEntry);

        // 限制日志条目数量
        if (logData.entries.length > logData.maxEntries) {
          logData.entries.pop();
        }

        updateLogDisplay();
      }

      // 新增：更新日志显示
      function updateLogDisplay() {
        const logContent = document.getElementById("logContent");
        logContent.innerHTML = "";

        logData.entries.forEach((entry) => {
          const logEntry = document.createElement("div");
          logEntry.className = "log-entry";

          const levelClass =
            {
              info: "info",
              success: "success",
              error: "error",
            }[entry.level] || "info";

          logEntry.innerHTML = `
                <span class="log-time">[${entry.time}]</span>
                <span class="log-level ${levelClass}">${levelClass}</span>
                <span class="log-message">${entry.action}: ${entry.message}</span>
            `;

          logContent.appendChild(logEntry);
        });

        // 自动显示日志区域
        const logSection = document.getElementById("logSection");
        if (logData.entries.length > 1) {
          // 不止有启动日志
          logSection.classList.add("show");
        }
      }

      // 新增：清空日志
      function clearLog() {
        logData.entries = [];
        updateLogDisplay();
        showNotification("日志已清空", "所有操作日志记录已被清除", "info");
        addLog("系统", "日志已清空", "info");
      }

      // 新增：切换日志显示
      function toggleLog() {
        const logSection = document.getElementById("logSection");
        const toggleBtn = document.getElementById("toggleLogBtn");

        if (logSection.classList.contains("show")) {
          logSection.classList.remove("show");
          toggleBtn.innerHTML = "<span>📋</span> 展开日志";
        } else {
          logSection.classList.add("show");
          toggleBtn.innerHTML = "<span>📋</span> 收起日志";
        }
      }

      function loadSavedToken() {
        const token = localStorage.getItem(getGithubTokenStorageKey());
        if (token) {
          document.getElementById("githubToken").value = token;
          console.log("✅ 从本地存储加载GitHub令牌");
        }
      }

      function updateStats() {
        const s = data.stats;
        const el = document.getElementById("githubStats");
        el.style.display = s.local + s.remote > 0 ? "flex" : "none";
        document.getElementById("localNodes").textContent = s.local;
        document.getElementById("remoteNodes").textContent = s.remote;
        document.getElementById("mergedNodes").textContent = s.merged;
        document.getElementById("uniqueNodes").textContent = s.unique;
        document.getElementById("syncNodeCount").textContent =
          `${s.unique}节点`;
      }

      function showLoading(show, buttonId = null) {
        if (buttonId) {
          // 按钮级别加载动画
          const button = document.getElementById(buttonId);
          if (button) {
            if (show) {
              button.classList.add("btn-loading");
              button.disabled = true;
            } else {
              button.classList.remove("btn-loading");
              button.disabled = false;
            }
          }
        } else {
          // 全局加载动画（保留作为后备）
          document.getElementById("loading").style.display = show
            ? "block"
            : "none";
        }
      }

      function copyText(text) {
        if (!text) {
          showNotification(
            "复制失败",
            "无内容可复制，请先生成或获取节点数据",
            "error",
          );
          return;
        }
        navigator.clipboard
          .writeText(text)
          .then(() => {
            showNotification(
              "复制成功",
              "内容已成功复制到剪贴板，可以粘贴到其他应用了",
              "success",
            );
            addLog("复制操作", "内容已复制到剪贴板", "success");
          })
          .catch((err) => {
            showNotification(
              "复制失败",
              "无法复制到剪贴板: " + err.message,
              "error",
            );
            addLog("复制操作", "复制失败: " + err.message, "error");
          });
      }

      // 移除downloadVless函数，只保留downloadAll函数
      function downloadAll() {
        if (!data.vlessLinks.length) {
          showNotification(
            "下载失败",
            "请先生成节点，当前没有可下载的数据",
            "error",
          );
          return;
        }
        const t = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
        downloadBlob(data.vlessLinks.join("\n"), `vless_${t}.txt`);
        downloadBlob(
          data.localBase64Content || utf8ToBase64(data.vlessLinks.join("\n")),
          `subscription_${t}.txt`,
        );
        showNotification(
          "下载成功",
          "已下载Vless链接和订阅文件到本地，请查看下载文件夹",
          "success",
        );
        addLog("下载", "已下载Vless链接和订阅文件到本地", "success");
      }

      // 从本地生成的Vless链接提取 IP:端口#别名 文本（CSV数据源）
      function buildCsvNodesTxtContent() {
        return (data.vlessLinks || [])
          .map((link) => {
            const match = String(link).match(
              /^vless:\/\/[^@]+@(\[[^\]]+\]|[^:?#]+):(\d+)(?:\?[^#]*)?(?:#(.*))?$/,
            );
            if (!match) return "";
            const address = match[1];
            const port = match[2];
            const rawAlias = match[3] || "";
            let alias = rawAlias;
            if (rawAlias) {
              try {
                alias = decodeURIComponent(rawAlias);
              } catch (e) {
                // 别名解码失败时保留原始内容
              }
            }
            return alias
              ? `${address}:${port}#${alias}`
              : `${address}:${port}`;
          })
          .filter(Boolean)
          .join("\n");
      }

      function downloadCsvNodesTxt() {
        if (!data.vlessLinks.length) {
          showNotification(
            "下载失败",
            "请先生成节点，当前没有可下载的数据",
            "error",
          );
          return;
        }
        const content = buildCsvNodesTxtContent();
        if (!content) {
          showNotification(
            "下载失败",
            "未能从Vless链接中提取IP和端口",
            "error",
          );
          return;
        }
        const fileName = getGithubFileInputValue("csvNodesFile", "csvNodes");
        downloadBlob(content, fileName);
        showNotification("下载成功", `已下载 ${fileName}`, "success");
        addLog("下载文件", `IP:端口文本 ${fileName} 已下载`, "success");
      }

      function downloadBlob(content, name) {
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
      }

      function readFile(file) {
        return new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = (e) => res(e.target.result);
          r.onerror = rej;
          r.readAsText(file);
        });
      }

      function formatSize(b) {
        const units = ["B", "KB", "MB", "GB"];
        let i = 0;
        while (b >= 1024 && i < units.length - 1) {
          b /= 1024;
          i++;
        }
        return b.toFixed(1) + " " + units[i];
      }

      function isValidIP(ip) {
        if (!ip || typeof ip !== "string") return false;

        const parts = ip.split(".");
        if (parts.length !== 4) return false;

        for (let i = 0; i < 4; i++) {
          const part = parseInt(parts[i], 10);
          if (isNaN(part) || part < 0 || part > 255) return false;
          // 检查前导零（除了0本身）
          if (parts[i].length > 1 && parts[i][0] === "0") return false;
        }

        return true;
      }

      // 新增：验证IPv6地址
      function isValidIPv6(ip) {
        if (!ip || typeof ip !== "string") return false;
        // 检查是否被方括号包裹，如果有则去掉
        let bare = ip;
        if (bare.startsWith("[") && bare.endsWith("]")) {
          bare = bare.substring(1, bare.length - 1);
        }
        // 标准IPv6正则（完整形式和压缩形式，含IPv4映射）
        const ipv6Regex =
          /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
        return ipv6Regex.test(bare);
      }

      // 新增：验证域名
      function isValidDomain(addr) {
        if (!addr || typeof addr !== "string") return false;
        // 允许标准域名格式（字母数字+连字符，每段1-63字符，至少有一个点）
        // 也允许纯数字TLD如 cdn.2158.cc
        return /^(?!:\/\/)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(
          addr,
        );
      }

      // 新增：验证任意类型的地址（IPv4 / IPv6 / 域名）
      function isValidAddress(addr) {
        return isValidIP(addr) || isValidIPv6(addr) || isValidDomain(addr);
      }

      // 新增：识别地址类型
      function getAddressType(addr) {
        if (!addr || typeof addr !== "string") return null;
        if (isValidIP(addr)) return "ipv4";
        if (isValidIPv6(addr)) return "ipv6";
        if (isValidDomain(addr)) return "domain";
        return null;
      }

      // 新增：缩短地址用于别名显示（IPv6地址可能很长）
      function shortenAddressForAlias(addr) {
        const type = getAddressType(addr);
        if (type === "ipv6") {
          // 取首尾两部分，中间用..连接
          const parts = addr.split(":");
          const cleanParts = parts.filter((p) => p !== "");
          if (cleanParts.length <= 4) return addr; // 已经是短形式
          return (
            cleanParts.slice(0, 2).join(":") +
            ".." +
            cleanParts[cleanParts.length - 1]
          );
        }
        return addr; // IPv4和域名直接返回
      }

      // 二维码模态及生成函数（使用外部API但带浏览器缓存，离线有友好降级）
      function showQR(targetUrl, label = "") {
        if (!targetUrl) {
          showNotification("二维码", "没有可生成的链接", "warning");
          return;
        }

        const qrConfig = getQrConfig();
        const size = Number(qrConfig.size) > 0 ? Number(qrConfig.size) : 320;
        const apiUrl = buildQrServiceUrl(
          qrConfig.fallbackService ||
            "https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&data={data}",
          size,
          targetUrl,
        );

        // 使用可读的缓存键（base64的URL）
        const cacheKey =
          (qrConfig.cacheKeyPrefix || "qr_cache_") +
          btoa(unescape(encodeURIComponent(targetUrl))).replace(/=/g, "");

        let modal = document.getElementById("qrModal");
        if (!modal) {
          modal = document.createElement("div");
          modal.id = "qrModal";
          modal.className = "custom-dialog-overlay";
          modal.innerHTML = `
                    <div class="custom-dialog">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                            <div style="font-weight:700">二维码预览</div>
                            <button id="closeQrBtn" class="custom-dialog-btn custom-dialog-btn-cancel">关闭</button>
                        </div>
                        <div style="text-align:center;">
                            <div id="qrSpinner" style="margin-bottom:8px;display:none;">生成中...</div>
                            <img id="qrImage" src="" alt="qr" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #e2e8f0;" />
                            <div id="qrLabel" style="margin-top:10px;font-size:13px;color:#4a5568;"></div>
                            <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;">
                                <a id="downloadQrLink" class="btn btn-primary btn-sm" href="#" download="qr.png">下载二维码</a>
                            </div>
                        </div>
                    </div>`;
          document.body.appendChild(modal);
          document
            .getElementById("closeQrBtn")
            .addEventListener("click", () => modal.remove());
        }

        const img = modal.querySelector("#qrImage");
        const dl = modal.querySelector("#downloadQrLink");
        const labelEl = modal.querySelector("#qrLabel");
        const spinner = modal.querySelector("#qrSpinner");

        labelEl.textContent = label || "";
        modal.style.display = "flex";

        // 如果已缓存dataURL，则直接使用（避免重复网络请求）
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            img.src = cached;
            dl.href = cached;
            return;
          }
        } catch (e) {
          console.warn("读取QR缓存失败", e);
        }

        // 若离线且无缓存，提示用户
        if (!navigator.onLine) {
          showNotification(
            "离线",
            "当前网络不可用，且无已缓存二维码，无法生成。",
            "error",
          );
          img.src = "";
          dl.href = "";
          return;
        }

        // 优先尝试本地生成（动态加载qrcode库），若无法加载再按顺序尝试多个外部API
        spinner.style.display = "block";
        img.style.opacity = "0.4";

        function loadScript(url) {
          return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = url;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error("加载脚本失败: " + url));
            document.head.appendChild(s);
          });
        }

        // 尝试在页面中使用 qrcodejs（如果已存在直接使用）
        async function tryLocalGenerate() {
          if (!window.QRCode) {
            // 从 CDN 动态加载（用户可根据网络调整）
            try {
              await loadScript(
                qrConfig.libraryUrl ||
                  "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
              );
            } catch (e) {
              console.warn("本地二维码库加载失败", e);
              return null;
            }
          }

          try {
            const tmp = document.createElement("div");
            tmp.style.position = "absolute";
            tmp.style.left = "-9999px";
            document.body.appendChild(tmp);
            // 生成到临时容器
            const qrcode = new QRCode(tmp, {
              text: targetUrl,
              width: size,
              height: size,
              correctLevel: QRCode.CorrectLevel.H,
            });
            // QRCode库会生成img或canvas，等待微任务
            await new Promise((resolve) => setTimeout(resolve, 50));
            let dataUrl = "";
            const imgEl = tmp.querySelector("img");
            const canvasEl = tmp.querySelector("canvas");
            if (imgEl && imgEl.src) {
              dataUrl = imgEl.src;
            } else if (canvasEl) {
              dataUrl = canvasEl.toDataURL("image/png");
            }
            document.body.removeChild(tmp);
            if (dataUrl) return dataUrl;
          } catch (e) {
            console.warn("本地生成二维码失败", e);
          }
          return null;
        }

        // 外部服务备选（来自 config.js 的 qr.services，按顺序尝试）
        const externalCandidates = (
          Array.isArray(qrConfig.services) ? qrConfig.services : []
        ).map((template) => buildQrServiceUrl(template, size, targetUrl));
        if (externalCandidates.length === 0) {
          externalCandidates.push(apiUrl);
        }

        // 备用：通过直接加载 <img> 的方式回退（不转换为dataURL）
        const imageTimeout =
          Number(qrConfig.imageTimeout) > 0
            ? Number(qrConfig.imageTimeout)
            : 4000;
        function tryImageLoad(url) {
          return new Promise((resolve) => {
            const testImg = new Image();
            testImg.onload = () => resolve(true);
            testImg.onerror = () => resolve(false);
            testImg.src = url;
            // 超时处理
            setTimeout(() => resolve(false), imageTimeout);
          });
        }

        (async () => {
          try {
            // 1) 本地生成
            const localData = await tryLocalGenerate();
            if (localData) {
              img.src = localData;
              dl.href = localData;
              spinner.style.display = "none";
              img.style.opacity = "1";
              try {
                localStorage.setItem(cacheKey, localData);
              } catch (e) {}
              return;
            }

            // 2) 使用外部候选按序尝试并缓存首个成功结果
            for (const urlCandidate of externalCandidates) {
              try {
                const res = await fetch(urlCandidate);
                if (!res.ok) throw new Error("服务返回" + res.status);
                const blob = await res.blob();
                const dataUrl = await new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result);
                  reader.onerror = reject;
                  reader.readAsDataURL(blob);
                });
                img.src = dataUrl;
                dl.href = dataUrl;
                spinner.style.display = "none";
                img.style.opacity = "1";
                try {
                  localStorage.setItem(cacheKey, dataUrl);
                } catch (e) {}
                return;
              } catch (e) {
                console.warn("外部候选 fetch 失败", urlCandidate, e);
                // 回退：尝试直接以 img.src 加载（无法转换为dataURL但可显示）
                try {
                  const ok = await tryImageLoad(urlCandidate);
                  if (ok) {
                    img.src = urlCandidate;
                    dl.href = urlCandidate;
                    spinner.style.display = "none";
                    img.style.opacity = "1";
                    showNotification(
                      "二维码",
                      "已使用图片直链回退显示（可能无法缓存）",
                      "info",
                    );
                    return;
                  }
                } catch (ie) {
                  console.warn("直接加载图片回退失败", ie);
                }
                continue;
              }
            }

            // 3) 最后回退到使用apiUrl直接赋值（可能无法绕过CORS）
            img.src = apiUrl;
            dl.href = apiUrl;
            spinner.style.display = "none";
            img.style.opacity = "1";
            showNotification(
              "二维码生成说明",
              "尝试了本地与多个外部服务均失败，已回退到直链显示，可能受CORS或网络限制。",
              "warning",
            );
          } catch (e) {
            console.error("二维码生成最终失败", e);
            spinner.style.display = "none";
            img.style.opacity = "1";
            img.src = apiUrl;
            dl.href = apiUrl;
            showNotification("二维码生成失败", e.message || String(e), "error");
          }
        })();
      }
      // 新增：IP地址位置缓存 - 避免重复调用和支持并行
      let locationCache = {};

      // 新增：带缓存的地理位置查询函数 - 支持并行查询
      async function getLocationCached(ip) {
        // 如果已缓存，直接返回
        if (locationCache[ip]) {
          return locationCache[ip];
        }

        // 调用原始getLocation并缓存结果
        const location = await window.IPGeolocationService.getIPLocation(ip);
        locationCache[ip] = location;
        return location;
      }

      /**
       * 自定义获取IP地址对应的国家/地区名称
       * @param {string} ip - IPv4地址
       * @returns {string} - 国家/地区名称或地区范围
       */
      function getLocation(ip) {
        return window.IPGeolocationService.getIPLocation(ip);
      }
