      function initEvents() {
        const csvColumnConfigToggle = document.getElementById(
          "csvColumnConfigToggle",
        );
        const csvColumnFields = document.getElementById("csvColumnFields");
        csvColumnConfigToggle.addEventListener("click", () => {
          const isExpanded =
            csvColumnConfigToggle.getAttribute("aria-expanded") === "true";
          csvColumnConfigToggle.setAttribute(
            "aria-expanded",
            String(!isExpanded),
          );
          csvColumnFields.hidden = isExpanded;
        });
        document.getElementById("host").addEventListener("input", (event) => {
          syncHostAndSni("host", event.target.value);
        });
        document.getElementById("sni").addEventListener("input", (event) => {
          syncHostAndSni("sni", event.target.value);
        });
        document
          .getElementById("fileInput")
          .addEventListener(
            "change",
            (e) =>
              e.target.files &&
              e.target.files.length > 0 &&
              handleFiles(Array.from(e.target.files)),
          );
        document
          .getElementById("removeFileBtn")
          .addEventListener("click", removeFile);
        document
          .getElementById("generateBtn")
          .addEventListener("click", generateVless);
        document
          .getElementById("previewNodesBtn")
          .addEventListener("click", showNodePreview);
        document
          .getElementById("copyVlessBtn")
          .addEventListener("click", () =>
            copyText(data.vlessLinks.join("\n")),
          );
        document
          .getElementById("copyRemoteVlessBtn")
          .addEventListener("click", () =>
            copyText(data.remoteNodes.join("\n")),
          );
        document
          .getElementById("generateRemoteVlessBtn")
          .addEventListener("click", generateRemoteVless);
        // 移除downloadVlessBtn事件监听，只保留downloadAllBtn
        document
          .getElementById("downloadAllBtn")
          .addEventListener("click", downloadAll);
        document
          .getElementById("downloadSubBtn")
          .addEventListener("click", () => {
            // 清除缓存，强制重新下载
            const now = Date.now();
            if (now - lastDownloadTimestamp > DOWNLOAD_CACHE_TIME) {
              // 如果距离上次下载超过2秒，清除缓存
              data.remoteNodes = [];
              data.nodeSha = null;
              data.plainSha = null;
              data.optimalSha = null;
              updateStats();
            }
            lastDownloadTimestamp = now;
            downloadRemote();
          });
        document.getElementById("mergeBtn").addEventListener("click", () => {
          validateAndMerge();
        });
        document
          .getElementById("syncBtn")
          .addEventListener("click", oneClickSync);
        document
          .getElementById("copyMergedBtn")
          .addEventListener("click", () =>
            copyText(data.uniqueNodes.join("\n")),
          );
        document
          .getElementById("copyMergedYamlBtn")
          .addEventListener("click", () => copyText(data.mergedYamlContent));
        document
          .getElementById("downloadMergedYamlBtn")
          .addEventListener("click", downloadMergedYaml);
        document
          .getElementById("copyLocalBase64Btn")
          .addEventListener("click", () => copyText(data.localBase64Content));
        document
          .getElementById("copyLocalYamlBtn")
          .addEventListener("click", () => copyText(data.localYamlContent));
        document
          .getElementById("downloadLocalYamlBtn")
          .addEventListener("click", downloadLocalYaml);
        document
          .getElementById("loadVlessDirectBtn")
          .addEventListener("click", loadVlessDirect);
        document
          .getElementById("clearVlessDirectBtn")
          .addEventListener("click", clearVlessDirect);

        // 删除远程文件（及其 .yaml）功能实现
        async function deleteSingleGithubFile(filePath) {
          const token = getGithubToken();
          const repo = getGithubRepo();
          const branch = getGithubBranch();
          const apiBaseUrl = getGithubApiBaseUrl();
          const apiAccept = getGithubApiAccept();
          if (!token)
            throw new Error(
              "缺少GitHub Token，请先在GitHub配置中输入有效的令牌",
            );
          if (!repo) throw new Error("缺少GitHub 仓库设置");
          if (!filePath) throw new Error("未指定要删除的文件名");

          // 先获取文件信息以获取 sha
          const metaRes = await fetch(
            `${apiBaseUrl}/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`,
            {
              headers: {
                Authorization: `token ${token}`,
                Accept: apiAccept,
              },
            },
          );
          if (metaRes.status === 404) {
            return { found: false };
          }
          if (!metaRes.ok) {
            const txt = await metaRes.text();
            throw new Error(`获取文件信息失败: ${metaRes.status} ${txt}`);
          }
          const meta = await metaRes.json();
          const sha = meta.sha;

          const delRes = await fetch(
            `${apiBaseUrl}/repos/${repo}/contents/${encodeURIComponent(filePath)}`,
            {
              method: "DELETE",
              headers: {
                Authorization: `token ${token}`,
                Accept: apiAccept,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: `Delete ${filePath} via UI`,
                sha: sha,
                branch: branch,
              }),
            },
          );
          if (!delRes.ok) {
            const txt = await delRes.text();
            throw new Error(`删除文件失败: ${delRes.status} ${txt}`);
          }
          return { found: true };
        }

        async function deleteGithubFiles(baseName) {
          if (!baseName) throw new Error("请输入要删除的文件名");
          const results = [];
          // 要删除的目标：baseName 以及对应的 YAML 文件
          const candidates = [baseName, toYamlFileName(baseName)];
          for (const f of candidates) {
            try {
              const r = await deleteSingleGithubFile(f);
              if (r.found) {
                results.push({ file: f, deleted: true });
              } else {
                results.push({ file: f, deleted: false, reason: "not found" });
              }
            } catch (e) {
              results.push({ file: f, deleted: false, reason: e.message });
            }
          }
          return results;
        }
        document
          .getElementById("copyAutoBase64Btn")
          .addEventListener("click", () => copyText(data.autoBase64Content));
        document
          .getElementById("convertToBase64Btn")
          .addEventListener("click", convertManualToBase64);
        document
          .getElementById("copyManualBase64Btn")
          .addEventListener("click", () => copyText(data.manualBase64Content));
        document
          .getElementById("convertToYamlBtn")
          .addEventListener("click", convertManualToYaml);
        document
          .getElementById("testParseBtn")
          .addEventListener("click", testVlessParse);
        document
          .getElementById("copyYamlBtn")
          .addEventListener("click", () => copyText(data.manualYamlContent));
        document
          .getElementById("downloadYamlBtn")
          .addEventListener("click", downloadManualYaml);
        document
          .getElementById("uploadYamlBtn")
          .addEventListener("click", uploadManualYaml);

        // 绑定：删除远程文件按钮
        const delBtn = document.getElementById("deleteRemoteFileBtn");
        if (delBtn) {
          delBtn.addEventListener("click", () => {
            const base = document.getElementById("deleteFileName").value.trim();
            if (!base) {
              showNotification(
                "错误",
                "请输入要删除的文件名（例如：Optimal）",
                "error",
              );
              return;
            }
            showConfirmDialog(
              "确认删除",
              `确定删除远程文件 ${base} 及 ${toYamlFileName(base)} 吗？此操作不可恢复。`,
              async () => {
                try {
                  showLoading(true, "deleteRemoteFileBtn");
                  const res = await deleteGithubFiles(base);
                  const ok = res.filter((r) => r.deleted).map((r) => r.file);
                  const not = res
                    .filter((r) => !r.deleted)
                    .map((r) => `${r.file}(${r.reason || "未找到"})`);
                  let msg = "";
                  if (ok.length) msg += `已删除：${ok.join(", ")}\n`;
                  if (not.length) msg += `未删除：${not.join(", ")}`;
                  showNotification(
                    "删除完成",
                    msg,
                    ok.length ? "success" : "warning",
                  );
                  addLog(
                    "删除远程文件",
                    `删除结果: ${msg}`,
                    ok.length ? "success" : "warning",
                  );
                } catch (e) {
                  showNotification("删除失败", e.message || String(e), "error");
                  addLog(
                    "删除远程文件",
                    "删除失败: " + (e.message || String(e)),
                    "error",
                  );
                } finally {
                  showLoading(false, "deleteRemoteFileBtn");
                }
              },
              null,
              "warning",
            );
          });
        }

        // 原有的四个上传按钮 - 添加确认提示
        //上传本地订阅至指定路径按钮点击事件
        document
          .getElementById("uploadLocalBase64ToPathBtn")
          .addEventListener("click", () => {
            validateAndUpload("uploadLocalBase64ToPath");
          });
        //上传合并明文订阅按钮点击事件
        document
          .getElementById("uploadPlainNodesBtn")
          .addEventListener("click", () => {
            validateAndUpload("uploadPlainNodes");
          });
        //上传合并主要订阅按钮点击事件
        document
          .getElementById("uploadMergedBase64Btn")
          .addEventListener("click", () => {
            validateAndUpload("uploadMergedBase64");
          });
        //上传合并优选订阅按钮点击事件
        document
          .getElementById("uploadMergedOptimalBtn")
          .addEventListener("click", () => {
            validateAndUpload("uploadMergedOptimal");
          });

        // 新增：上传合并订阅至指定路径按钮
        document
          .getElementById("uploadMergedToPathBtn")
          .addEventListener("click", () => {
            validateAndUpload("uploadMergedToPath");
          });

        // 新增：下载路径选择事件
        document
          .getElementById("downloadUrlSelect")
          .addEventListener("change", function () {
            const customInput = document.getElementById("customDownloadUrl");
            customInput.classList.toggle("show", this.value === "custom");
            if (this.value !== "custom") {
              customInput.value = "";
            }
          });

        // 新增：上传路径选择事件
        document
          .getElementById("uploadPathSelect")
          .addEventListener("change", function () {
            const customInput = document.getElementById("customUploadPath");
            customInput.classList.toggle("show", this.value === "custom");
            if (this.value !== "custom") {
              customInput.value = "";
            }
          });

        // 新增：日志控制按钮事件
        document
          .getElementById("clearLogBtn")
          .addEventListener("click", clearLog);
        document
          .getElementById("toggleLogBtn")
          .addEventListener("click", toggleLog);

        // 新增：订阅链接复制按钮事件
        document
          .getElementById("copyPlainNodesUrl")
          .addEventListener("click", () => copyGithubUrl("plainNodesUrl"));
        document
          .getElementById("copyMergedBase64Url")
          .addEventListener("click", () => copyGithubUrl("mergedBase64Url"));
        document
          .getElementById("copyMergedYamlUrl")
          .addEventListener("click", () => copyGithubUrl("mergedYamlUrl"));
        document
          .getElementById("copyMergedOptimalUrl")
          .addEventListener("click", () => copyGithubUrl("mergedOptimalUrl"));
        document
          .getElementById("copyLocalBase64Url")
          .addEventListener("click", () => copyGithubUrl("localBase64Url"));
        document
          .getElementById("copyLocalYamlUrl")
          .addEventListener("click", () => copyGithubUrl("localYamlUrl"));
        document
          .getElementById("copyMergedToPathUrl")
          .addEventListener("click", () => copyGithubUrl("mergedToPathUrl"));
        document
          .getElementById("copyYamlConfigUrl")
          .addEventListener("click", () => copyGithubUrl("yamlConfigUrl"));

        // 新增：代理工具下载按钮事件
        document
          .getElementById("downloadClashBtn")
          .addEventListener("click", () => downloadProxyConfig("clash"));

        // 二维码显示（模态）控制：当点击外部按钮时会调用 showQR(url, label)
        document.addEventListener("click", (e) => {
          if (
            e.target &&
            e.target.classList &&
            e.target.classList.contains("show-qr-btn")
          ) {
            const url = e.target.getAttribute("data-url");
            const label = e.target.getAttribute("data-label") || "";
            showQR(url, label);
          }
        });

        // 修复：粘贴CSV内容生成节点的功能
        let csvTimer;
        const csvAutoGenerateDelay =
          Number((getWebConfig().ui || {}).csvAutoGenerateDelay) || 0;
        document.getElementById("csvInput").addEventListener("input", () => {
          clearTimeout(csvTimer);
          // 当用户停止输入后自动生成（延迟由 config.js 配置）
          csvTimer = setTimeout(() => {
            if (data.currentSource !== "file") {
              generateVless();
            }
          }, csvAutoGenerateDelay);
        });

        document
          .getElementById("vlessDirectInput")
          .addEventListener("input", () => {
            data.currentSource = "direct";
            updateSourceBadge();
          });

        // 修复：当切换到粘贴标签页时，如果已有内容，自动生成
        document.addEventListener("click", (e) => {
          if (
            e.target.classList.contains("card-tab-btn") &&
            e.target.getAttribute("data-tab") === "paste-tab"
          ) {
            const csvInput = document.getElementById("csvInput");
            if (csvInput.value.trim() && data.currentSource !== "file") {
              generateVless();
            }
          }
        });

        // 新增：手动Vless转IP:端口按钮事件
        document
          .getElementById("convertToIpPortBtn")
          .addEventListener("click", convertManualToIpPort);
        document
          .getElementById("copyIpPortBtn")
          .addEventListener("click", () => copyText(data.manualIpPortContent));
        document
          .getElementById("downloadIpPortBtn")
          .addEventListener("click", downloadIpPortTxt);

        // 初始化手动转换工具标签页
        const manualTabNav = document.getElementById("manualTabNav");
        if (manualTabNav) {
          const tabButtons = manualTabNav.querySelectorAll(".card-tab-btn");
          tabButtons.forEach((button) => {
            button.addEventListener("click", (e) => {
              const cardBody = button.closest(".card-body");
              const tabId = button.getAttribute("data-tab");

              // 只在当前卡片内部切换
              const allTabBtns = cardBody.querySelectorAll(".card-tab-btn");
              const allTabContents =
                cardBody.querySelectorAll(".card-tab-content");

              allTabBtns.forEach((btn) => btn.classList.remove("active"));
              allTabContents.forEach((content) =>
                content.classList.remove("active"),
              );

              button.classList.add("active");
              const targetTab = cardBody.querySelector(`#${tabId}`);
              if (targetTab) {
                targetTab.classList.add("active");
              }
            });
          });
        }

        // 初始化自动同步控件（已移除）
      }

