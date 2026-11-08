      // 新增：统一的确认对话框 - 更简洁大气，支持键盘快捷键
      function showConfirmDialog(
        title,
        message,
        onConfirm,
        onCancel = null,
        type = "info",
      ) {
        // 移除已存在的对话框
        const existingDialog = document.querySelector(".custom-dialog-overlay");
        if (existingDialog) {
          existingDialog.remove();
          if (dialogKeyHandler) {
            document.removeEventListener("keydown", dialogKeyHandler);
            dialogKeyHandler = null;
          }
        }

        // 创建遮罩层
        const overlay = document.createElement("div");
        overlay.className = "custom-dialog-overlay";

        // 根据类型设置图标
        let iconText = "!";
        let dialogClass = "";

        if (type === "warning") iconText = "⚠";
        else if (type === "error") iconText = "✕";
        else if (type === "success") iconText = "✓";

        if (type !== "info") dialogClass = ` ${type}`;

        // 创建对话框
        const dialog = document.createElement("div");
        dialog.className = `custom-dialog${dialogClass}`;
        dialog.tabIndex = -1; // 使对话框可聚焦

        dialog.innerHTML = `
            <div class="custom-dialog-header">
                <div class="custom-dialog-icon">${iconText}</div>
                <h3 class="custom-dialog-title">${title}</h3>
            </div>
            <div class="custom-dialog-content">${message}</div>
            <div class="custom-dialog-actions">
                <button class="custom-dialog-btn custom-dialog-btn-cancel" id="dialogCancelBtn">
                    取消 (ESC)
                </button>
                <button class="custom-dialog-btn custom-dialog-btn-confirm" id="dialogConfirmBtn">
                    确认 (Enter)
                </button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 关闭对话框函数
        const closeDialog = (action) => {
          // 移除事件监听
          if (dialogKeyHandler) {
            document.removeEventListener("keydown", dialogKeyHandler);
            dialogKeyHandler = null;
          }
          overlay.remove();

          // 执行相应的回调
          if (action === "confirm" && onConfirm) {
            onConfirm();
          } else if (action === "cancel" && onCancel) {
            onCancel();
          }
        };

        // 键盘事件处理函数
        dialogKeyHandler = (e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            closeDialog("cancel");
          } else if (
            e.key === "Enter" &&
            !e.ctrlKey &&
            !e.altKey &&
            !e.shiftKey
          ) {
            e.preventDefault();
            e.stopPropagation();
            closeDialog("confirm");
          }
        };

        // 添加键盘事件监听
        document.addEventListener("keydown", dialogKeyHandler);

        // 绑定按钮点击事件
        document
          .getElementById("dialogConfirmBtn")
          .addEventListener("click", () => {
            closeDialog("confirm");
          });

        document
          .getElementById("dialogCancelBtn")
          .addEventListener("click", () => {
            closeDialog("cancel");
          });

        // 点击遮罩层关闭（相当于取消）
        overlay.addEventListener("click", (e) => {
          if (e.target === overlay) {
            closeDialog("cancel");
          }
        });

        // 对话框获取焦点，方便键盘操作
        setTimeout(() => {
          dialog.focus();
          document.getElementById("dialogCancelBtn").focus(); // 默认焦点在取消按钮
        }, 100);
      }

      // 新增：验证并合并 - 智能缓存检查
      function validateAndMerge() {
        const localCount = data.vlessLinks.length;
        const remoteCount = data.remoteNodes.length;
        const cachedRemoteCount = data.cache.remoteNodes.length;

        // 检查是否有可用的节点数据
        if (localCount === 0 && remoteCount === 0 && cachedRemoteCount === 0) {
          showConfirmDialog(
            "无法合并",
            "本地和远程都没有节点数据，无法进行合并操作。<br><br>请先生成本地节点或下载远程订阅。",
            () => {
              showNotification("提示", "请先生成节点或下载远程订阅", "info");
            },
            null,
            "warning",
          );
          return;
        }

        // 检查是否需要使用缓存数据
        if (localCount > 0 && remoteCount === 0 && cachedRemoteCount > 0) {
          showConfirmDialog(
            "使用缓存数据",
            `本地有 <strong>${localCount}</strong> 个节点，远程节点数据为空，但缓存中有 <strong>${cachedRemoteCount}</strong> 个远程节点。<br><br>是否使用缓存中的远程节点进行合并？<br><br>提示：如果缓存数据可能已过时，建议重新下载远程订阅。`,
            () => {
              // 使用缓存数据
              data.remoteNodes = [...data.cache.remoteNodes];
              data.stats.remote = data.remoteNodes.length;
              displayRemoteVlessLinks();
              updateStats();
              mergeAndShow();
            },
            () => {
              // 用户选择不合并
              showNotification("提示", "已取消合并操作", "info");
            },
            "info",
          );
          return;
        }

        // 检查本地节点是否为空
        if (localCount === 0 && (remoteCount > 0 || cachedRemoteCount > 0)) {
          const actualRemoteCount =
            remoteCount > 0 ? remoteCount : cachedRemoteCount;
          showConfirmDialog(
            "确认合并",
            `本地没有生成节点，但有 <strong>${actualRemoteCount}</strong> 个远程节点。<br><br>是否继续合并（仅使用远程节点）？<br><br>提示：您可以先生成本地节点再合并。`,
            () => {
              // 如果当前远程节点为空但缓存有数据，使用缓存
              if (remoteCount === 0 && cachedRemoteCount > 0) {
                data.remoteNodes = [...data.cache.remoteNodes];
                data.stats.remote = data.remoteNodes.length;
                displayRemoteVlessLinks();
                updateStats();
              }
              mergeAndShow();
            },
            () => {
              // 用户选择不合并
              showNotification("提示", "已取消合并操作", "info");
            },
            "info",
          );
          return;
        }

        // 检查远程节点是否为空
        if (remoteCount === 0 && localCount > 0) {
          showConfirmDialog(
            "确认合并",
            `远程没有节点，本地有 <strong>${localCount}</strong> 个节点。<br><br>是否继续合并（仅使用本地节点）？<br><br>提示：您可以先下载远程订阅再合并。`,
            () => {
              mergeAndShow();
            },
            () => {
              // 用户选择不合并
              showNotification("提示", "已取消合并操作", "info");
            },
            "info",
          );
          return;
        }

        // 正常合并
        const totalNodes = localCount + remoteCount;
        showConfirmDialog(
          "确认合并",
          `即将合并本地 <strong>${localCount}</strong> 个节点和远程 <strong>${remoteCount}</strong> 个节点，总计 <strong>${totalNodes}</strong> 个节点。<br><br>合并后将自动去重并重新设置别名。<br><br>是否继续？`,
          () => {
            mergeAndShow();
          },
          () => {
            // 用户选择不合并
            showNotification("提示", "已取消合并操作", "info");
          },
          "info",
        );
      }

      // 新增：验证并上传
      function validateAndUpload(uploadFunction) {
        let nodeCount = 0;
        let targetPath = "";
        let uploadFunc = null;
        let uploadType = "";

        // 根据不同的上传函数设置参数
        switch (uploadFunction) {
          case "uploadLocalBase64ToPath":
            nodeCount = data.vlessLinks.length;
            if (nodeCount === 0) {
              showNotification(
                "上传失败",
                "请先生成本地节点，当前没有可上传的节点数据",
                "warning",
              );
              return;
            }
            const uploadSelection = resolveSelectedPathTarget(
              "uploadPathSelect",
              "customUploadPath",
            );
            if (!uploadSelection.file) {
              showNotification(
                "上传失败",
                "请输入自定义上传路径，或选择预定义路径",
                "error",
              );
              return;
            }
            targetPath = uploadSelection.file;
            uploadFunc = () => uploadLocalBase64ToPath();
            uploadType = "本地订阅";
            break;

          case "uploadPlainNodes":
            nodeCount = data.uniqueNodes.length;
            if (nodeCount === 0) {
              showNotification(
                "上传失败",
                "请先合并节点，当前没有可上传的合并节点数据",
                "warning",
              );
              return;
            }
            targetPath = getGithubFileInputValue("plainNodeFile", "plain");
            uploadFunc = () => uploadPlainNodes();
            uploadType = "合并明文订阅";
            break;

          case "uploadMergedBase64":
            nodeCount = data.uniqueNodes.length;
            if (nodeCount === 0) {
              showNotification(
                "上传失败",
                "请先合并节点，当前没有可上传的合并节点数据",
                "warning",
              );
              return;
            }
            targetPath = getGithubFileInputValue("mainNodeFile", "main");
            uploadFunc = () => uploadMergedBase64();
            uploadType = "合并主要订阅";
            break;

          case "uploadMergedOptimal":
            nodeCount = data.uniqueNodes.length;
            if (nodeCount === 0) {
              showNotification(
                "上传失败",
                "请先合并节点，当前没有可上传的合并节点数据",
                "warning",
              );
              return;
            }
            targetPath = getGithubFileInputValue("optimalNodeFile", "optimal");
            uploadFunc = () => uploadMergedOptimal();
            uploadType = "合并优选订阅";
            break;

          case "uploadMergedToPath":
            nodeCount = data.uniqueNodes.length;
            if (nodeCount === 0) {
              showNotification(
                "上传失败",
                "请先合并节点，当前没有可上传的合并节点数据",
                "warning",
              );
              return;
            }
            const mergedToPathSelection = resolveSelectedPathTarget(
              "uploadPathSelect",
              "customUploadPath",
            );
            if (!mergedToPathSelection.file) {
              showNotification(
                "上传失败",
                "请输入自定义上传路径，或选择预定义路径",
                "error",
              );
              return;
            }
            targetPath = mergedToPathSelection.file;
            uploadFunc = () => uploadMergedToPath();
            uploadType = "合并订阅到指定路径";
            break;
        }

        if (nodeCount === 0) {
          showNotification("上传失败", "没有可上传的节点数据", "warning");
          return;
        }

        showConfirmDialog(
          "确认上传",
          `将 <strong>${nodeCount} 个节点</strong> 上传到 <strong>${targetPath}</strong><br><br>上传类型：${uploadType}<br><br>是否继续？<br><br>提示：上传后将更新远程文件，请确保有正确的GitHub权限。`,
          uploadFunc,
          () => {
            showNotification("提示", "已取消上传操作", "info");
          },
          "info",
        );
      }

      // 修复：下载远程订阅功能 - 使用更简单可靠的逻辑
      async function downloadRemote() {
        showLoading(true, "downloadSubBtn");
        try {
          const token = getGithubToken();
          if (!token) {
            showNotification(
              "下载失败",
              "请先输入GitHub Token，否则无法访问远程仓库",
              "error",
            );
            showLoading(false, "downloadSubBtn");
            return;
          }

          const repo = getGithubRepo();
          if (!repo) {
            showNotification(
              "下载失败",
              "请先输入GitHub仓库名称，格式为：用户名/仓库名",
              "error",
            );
            showLoading(false, "downloadSubBtn");
            return;
          }

          const branch = getGithubBranch();
          const apiBaseUrl = getGithubApiBaseUrl();
          const apiAccept = getGithubApiAccept();

          // 获取选择的下载路径
          const selection = resolveSelectedPathTarget(
            "downloadUrlSelect",
            "customDownloadUrl",
          );
          if (!selection.file) {
            showNotification(
              "下载失败",
              "请输入自定义路径，或选择预定义路径",
              "error",
            );
            showLoading(false, "downloadSubBtn");
            return;
          }
          const targetFile = selection.file;

          // 根据选择的路径设置要下载的文件
          const mainNodeFile = getGithubFileInputValue(
            "mainNodeFile",
            "main",
          );
          const plainNodeFile = getGithubFileInputValue(
            "plainNodeFile",
            "plain",
          );
          const optimalNodeFile = getGithubFileInputValue(
            "optimalNodeFile",
            "optimal",
          );

          let downloadFiles = [];

          if (selection.key === "main") {
            downloadFiles = [{ file: mainNodeFile, type: "base64" }];
          } else if (selection.key === "plain") {
            downloadFiles = [{ file: plainNodeFile, type: "plain" }];
          } else if (selection.key === "optimal") {
            downloadFiles = [{ file: optimalNodeFile, type: "base64" }];
          } else {
            // 自定义路径，尝试下载
            downloadFiles = [{ file: targetFile, type: "unknown" }];
          }

          // 清除当前远程节点数据，准备重新下载
          data.remoteNodes = [];

          let totalDownloaded = 0;
          let successCount = 0;

          for (const fileInfo of downloadFiles) {
            try {
              // 添加时间戳防止缓存
              const timestamp = Date.now();
              const fileUrl = `${apiBaseUrl}/repos/${repo}/contents/${fileInfo.file}?ref=${branch}&t=${timestamp}`;

              console.log(`正在下载文件: ${fileInfo.file}`, fileUrl);

              const fileRes = await fetch(fileUrl, {
                headers: {
                  Authorization: `token ${token}`,
                  Accept: apiAccept,
                },
              });

              if (fileRes.ok) {
                const fileJson = await fileRes.json();
                const fileContent = atob(fileJson.content.replace(/\n/g, ""));

                console.log(
                  `✅ 文件 ${fileInfo.file} 下载成功，原始内容长度: ${fileContent.length}`,
                );

                let nodes = [];

                // 简化解析逻辑：首先尝试Base64解码
                try {
                  // 先尝试解码一次Base64
                  const decodedContent = atob(fileContent);

                  // 检查解码后的内容是否包含vless://
                  if (decodedContent.includes("vless://")) {
                    // 成功找到vless链接
                    nodes = decodedContent
                      .split(/\r?\n/)
                      .filter((l) => l.trim().startsWith("vless://"));
                    console.log(
                      `✅ Base64解码成功，找到 ${nodes.length} 个节点`,
                    );
                  } else {
                    // 可能还有一层Base64编码（双重Base64）
                    try {
                      const doubleDecoded = atob(decodedContent);
                      if (doubleDecoded.includes("vless://")) {
                        nodes = doubleDecoded
                          .split(/\r?\n/)
                          .filter((l) => l.trim().startsWith("vless://"));
                        console.log(
                          `✅ 双重Base64解码成功，找到 ${nodes.length} 个节点`,
                        );
                      } else {
                        // 如果都不是，尝试直接解析原始内容
                        nodes = fileContent
                          .split(/\r?\n/)
                          .filter((l) => l.trim().startsWith("vless://"));
                        console.log(`✅ 直接解析找到 ${nodes.length} 个节点`);
                      }
                    } catch (e2) {
                      // 双重Base64解码失败，尝试直接解析
                      nodes = fileContent
                        .split(/\r?\n/)
                        .filter((l) => l.trim().startsWith("vless://"));
                      console.log(
                        `✅ 双重Base64解码失败，直接解析找到 ${nodes.length} 个节点`,
                      );
                    }
                  }
                } catch (e) {
                  // Base64解码失败，直接解析原始内容
                  console.log(`⚠️ Base64解码失败，尝试直接解析: ${e.message}`);
                  nodes = fileContent
                    .split(/\r?\n/)
                    .filter((l) => l.trim().startsWith("vless://"));
                  console.log(`✅ 直接解析找到 ${nodes.length} 个节点`);
                }

                // 如果还没有节点，尝试最直接的解析方式
                if (nodes.length === 0) {
                  // 直接按行分割，尝试查找vless链接
                  const lines = fileContent.split(/\r?\n/);
                  for (const line of lines) {
                    if (line.includes("vless://")) {
                      // 提取vless链接
                      const vlessMatch = line.match(/vless:\/\/[^\s]+/);
                      if (vlessMatch) {
                        nodes.push(vlessMatch[0]);
                      }
                    }
                  }
                  console.log(
                    `✅ 直接搜索vless链接找到 ${nodes.length} 个节点`,
                  );
                }

                data.remoteNodes = [...data.remoteNodes, ...nodes];
                totalDownloaded += nodes.length;
                successCount++;

                // 保存sha值
                if (fileInfo.file === mainNodeFile) {
                  data.nodeSha = fileJson.sha;
                } else if (fileInfo.file === plainNodeFile) {
                  data.plainSha = fileJson.sha;
                } else if (fileInfo.file === optimalNodeFile) {
                  data.optimalSha = fileJson.sha;
                }
              } else {
                console.log(
                  `❌ ${fileInfo.file} 文件下载失败: ${fileRes.status}`,
                );
                if (fileRes.status === 404) {
                  showNotification(
                    "文件不存在",
                    `文件 ${fileInfo.file} 不存在于仓库中`,
                    "info",
                  );
                } else {
                  const err = await fileRes.json();
                  console.log("错误详情:", err);
                }
              }
            } catch (e) {
              console.log(`❌ ${fileInfo.file} 文件下载失败:`, e);
            }
          }

          // 去重
          const seen = new Set();
          const uniqueNodes = [];
          data.remoteNodes.forEach((node) => {
            // 提取IP和端口作为唯一标识
            const match = node.match(/@([^:]+):(\d+)/);
            const key = match ? `${match[1]}:${match[2]}` : node;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueNodes.push(node);
            }
          });

          data.remoteNodes = uniqueNodes;
          data.stats.remote = data.remoteNodes.length;
          displayRemoteVlessLinks();

          // 更新缓存
          data.cache.remoteNodes = [...data.remoteNodes];
          data.cache.lastDownloadTime = Date.now();
          data.cache.downloadPath = targetFile;
          data.cache.needsUpdate = false;

          updateStats();

          if (data.remoteNodes.length === 0) {
            showNotification(
              "下载完成",
              `从 ${targetFile} 获取到 0 个节点，文件可能为空、不存在或格式不支持`,
              "info",
            );
            addLog("下载远程", `从 ${targetFile} 获取 0 个节点`, "info");
          } else {
            showNotification(
              "下载成功",
              `成功从 ${targetFile} 下载 ${data.remoteNodes.length} 个节点，已自动去重`,
              "success",
            );
            addLog(
              "下载远程",
              `从 ${targetFile} 获取 ${data.remoteNodes.length} 个节点`,
              "success",
            );

            // 如果本地已有节点，提示合并
            if (data.vlessLinks.length > 0) {
              setTimeout(() => {
                showNotification(
                  "提示",
                  `本地有 ${data.vlessLinks.length} 个节点，远程有 ${data.remoteNodes.length} 个节点，点击"合并节点"按钮进行合并`,
                  "info",
                );
              }, 500);
            }
          }
        } catch (e) {
          console.error("❌ 下载失败:", e);
          showNotification(
            "下载失败",
            "下载过程中发生错误: " + e.message,
            "error",
          );
          addLog("下载远程", "下载失败: " + e.message, "error");
        } finally {
          showLoading(false, "downloadSubBtn");
        }
      }
      // 新增：检测别名是否是格式化的别名
      function isFormattedAlias(remark) {
        if (!remark) return false;

        // 格式1：地区名+序号+端口 (如：日本01-443, 香港02-8080)
        const pattern1 = /^[^\d]+\d{2,}-\d+$/;

        // 格式2：地区名-序号-端口 (如：日本-01-443)
        const pattern2 = /^[^-]+-\d{2,}-\d+$/;

        // 格式3：包含中文或英文名称，不是IP:端口格式
        const isIpPort = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(
          remark,
        );

        return (pattern1.test(remark) || pattern2.test(remark)) && !isIpPort;
      }

      // 新增：提取别名中的地区名
      function extractRegionFromAlias(remark) {
        if (!remark) return null;

        // 尝试匹配格式：地区名+序号 或 地区名-序号
        const match1 = remark.match(/^([^\d]+)\d{2,}/); // 日本01-443
        if (match1) return match1[1].trim();

        const match2 = remark.match(/^([^-]+)-\d{2,}/); // 日本-01-443
        if (match2) return match2[1].trim();

        return null;
      }

      async function mergeAndShow() {
        const all = [...data.vlessLinks, ...data.remoteNodes];

        if (data.currentSource === "direct" && data.remoteNodes.length === 0) {
          data.uniqueNodes = [...new Set(data.vlessLinks)];
          data.stats.merged = data.uniqueNodes.length;
          data.stats.unique = data.uniqueNodes.length;
          updateStats();
          data.autoBase64Content = utf8ToBase64(data.uniqueNodes.join("\n"));
          data.mergedYamlContent = generateClashYAML(data.uniqueNodes);
          document.getElementById("autoBase64Output").textContent =
            data.autoBase64Content;
          document.getElementById("autoBase64Output").classList.remove("empty");
          document.getElementById("mergedResult").textContent =
            data.uniqueNodes.join("\n\n");
          document.getElementById("mergedYamlOutput").textContent =
            data.mergedYamlContent;
          document.getElementById("mergedYamlOutput").classList.remove("empty");
          addLog(
            "合并节点",
            `直链已保留原样，共 ${data.uniqueNodes.length} 个节点`,
            "success",
          );
          return;
        }

        const seen = new Set();
        data.uniqueNodes = [];

        // 提取所有节点的IP、端口和别名信息
        const nodeInfos = all
          .map((node) => {
            // 使用更宽松的正则匹配
            const ipPortMatch = node.match(/@([^:]+):(\d+)/);
            const remarkMatch = node.match(/#([^"]+)/);

            if (ipPortMatch) {
              const ip = ipPortMatch[1];
              const port = ipPortMatch[2];
              const remark = remarkMatch
                ? decodeURIComponent(remarkMatch[1])
                : `${ip}:${port}`;

              return {
                ip: ip,
                port: port,
                remark: remark,
                full: node,
                source: data.vlessLinks.includes(node) ? "local" : "remote",
              };
            }
            return null;
          })
          .filter((info) => info !== null);

        // 去重：基于IP和端口
        const uniqueNodeMap = new Map();

        nodeInfos.forEach((info) => {
          const key = `${info.ip}:${info.port}`;

          if (!uniqueNodeMap.has(key)) {
            // 第一个遇到这个IP:端口的节点，直接使用
            uniqueNodeMap.set(key, info);
          } else {
            // 如果已经存在，选择更好的别名（优先保留有具体名称的）
            const existing = uniqueNodeMap.get(key);
            const existingHasName =
              existing.remark && !existing.remark.includes(":");
            const newHasName = info.remark && !info.remark.includes(":");

            // 规则：优先保留有具体名称的别名，而不是IP:端口格式
            if (newHasName && !existingHasName) {
              uniqueNodeMap.set(key, info);
            }
            // 如果都有名称或都没有名称，优先保留本地节点的别名
            else if (info.source === "local" && existing.source === "remote") {
              uniqueNodeMap.set(key, info);
            }
          }
        });

        // 转换为数组
        const uniqueInfos = Array.from(uniqueNodeMap.values());

        // 检查是否需要重新设置别名
        const shouldRename = document.getElementById("renameOnMerge").checked;

        if (shouldRename && uniqueInfos.length > 0) {
          // 智能重命名：只重命名那些别名是IP:端口格式的节点
          const config = getConfig();
          const nodesToRename = [];
          const nodesToKeep = [];

          // 分类节点：哪些需要重命名，哪些保留
          uniqueInfos.forEach((info) => {
            // 判断是否是IP:端口格式
            const isIpPortFormat =
              /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/.test(info.remark);

            if (isIpPortFormat) {
              // IP:端口格式，需要重命名
              nodesToRename.push(info);
            } else {
              // 其他格式的别名（可能是用户自定义的或已格式化的），保留
              nodesToKeep.push(info);
            }
          });

          // 对需要重命名的节点按地区分组（异步地理位置检测）
          const regionGroups = {};
          for (const info of nodesToRename) {
            const regionName = await getLocation(info.ip);
            let finalRegion;
            let isUnknownRegion = false;
            if (regionName !== "未知") {
              finalRegion = regionName;
            } else {
              finalRegion = config.prefix;
              isUnknownRegion = true;
            }

            if (!regionGroups[finalRegion]) {
              regionGroups[finalRegion] = {
                nodes: [],
                counter: 1,
                isUnknownRegion: isUnknownRegion,
              };
            }

            regionGroups[finalRegion].nodes.push({
              ip: info.ip,
              port: info.port,
              config: config,
              sequence: regionGroups[finalRegion].counter++,
            });
          }

          // 生成重命名后的节点
          const renamedNodes = [];
          Object.keys(regionGroups).forEach((regionName) => {
            regionGroups[regionName].nodes.forEach((node) => {
              // 只有IP和端口的情况，使用格式：地区名(序号)-端口-IP
              // 序号默认关闭(节点配置中可开启);获取不到地区的节点始终带序号
              const remark = buildNodeAlias({
                name: regionName,
                sub: "",
                sequence: node.sequence,
                showSequence: config.showSequence,
                alwaysSequence: regionGroups[regionName].isUnknownRegion,
                showSpeed: false,
                speed: "",
                port: node.port,
                address: shortenAddressForAlias(node.ip),
              });
              renamedNodes.push(
                generateLink(node.ip, node.port, node.config, remark),
              );
            });
          });

          // 保留不需要重命名的节点
          const keptNodes = nodesToKeep.map((info) => info.full);

          // 合并所有节点
          data.uniqueNodes = [...renamedNodes, ...keptNodes];

          // 显示重命名统计
          if (renamedNodes.length > 0) {
            showNotification(
              "智能合并完成",
              `共 ${uniqueInfos.length} 个节点：${renamedNodes.length} 个IP:端口格式的节点已重命名，${keptNodes.length} 个节点保留原有别名`,
              "success",
            );
          }
        } else {
          // 不重命名，直接使用原有别名
          data.uniqueNodes = uniqueInfos.map((info) => info.full);
        }

        // 更新统计数据
        data.stats.merged = all.length;
        data.stats.unique = data.uniqueNodes.length;

        // 如果合并后节点数量为0，使用本地和远程节点数量中较大的一个
        if (data.stats.unique === 0) {
          data.stats.unique = Math.max(
            data.vlessLinks.length,
            data.remoteNodes.length,
          );
        }

        updateStats();

        const plainText = data.uniqueNodes.join("\n");
        data.autoBase64Content = utf8ToBase64(plainText);

        // 生成对应的YAML内容
        data.mergedYamlContent = data.uniqueNodes.length
          ? generateClashYAML(data.uniqueNodes)
          : "";

        document.getElementById("autoBase64Output").textContent =
          data.autoBase64Content;
        document
          .getElementById("autoBase64Output")
          .classList.toggle("empty", data.uniqueNodes.length === 0);
        document.getElementById("mergedResult").textContent = data.uniqueNodes
          .length
          ? data.uniqueNodes.join("\n\n")
          : "无节点";
        document.getElementById("mergedYamlOutput").textContent =
          data.mergedYamlContent;
        document
          .getElementById("mergedYamlOutput")
          .classList.toggle("empty", data.uniqueNodes.length === 0);

        // 显示合并完成通知
        if (data.uniqueNodes.length > 0) {
          addLog(
            "合并节点",
            `合并完成！共 ${data.uniqueNodes.length} 个节点`,
            "success",
          );
        } else {
          addLog("合并节点", "合并完成，但未生成任何节点", "info");
        }
      }

      // 修复：上传本地生成Base64(本地订阅)到指定路径 - 修正文件格式问题
      async function uploadLocalBase64ToPath() {
        showLoading(true, "uploadLocalBase64ToPathBtn");
        try {
          if (data.vlessLinks.length === 0) {
            showNotification(
              "上传失败",
              "请先生成本地节点，当前没有可上传的节点数据",
              "error",
            );
            showLoading(false, "uploadLocalBase64ToPathBtn");
            return;
          }

          // 获取选择的上传路径
          const selection = resolveSelectedPathTarget(
            "uploadPathSelect",
            "customUploadPath",
          );
          if (!selection.file) {
            showNotification(
              "上传失败",
              "请输入自定义上传路径，或选择预定义路径",
              "error",
            );
            showLoading(false, "uploadLocalBase64ToPathBtn");
            return;
          }
          const targetFile = selection.file;
          const isPlain = selection.key === "plain";

          // 根据目标路径决定上传格式
          let contentToUpload = "";

          if (isPlain) {
            // Plain：上传明文节点
            contentToUpload = utf8ToBase64(data.vlessLinks.join("\n"));
          } else {
            // Optimal、Main 和自定义路径：上传双重Base64编码
            const firstBase64 = utf8ToBase64(data.vlessLinks.join("\n"));
            contentToUpload = btoa(firstBase64);
          }

          // 使用通用上传函数
          const result = await uploadToGitHub(
            targetFile,
            contentToUpload,
            !isPlain,
            `上传本地订阅到 ${targetFile} - ${new Date().toLocaleString()} (${data.vlessLinks.length}节点)`,
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建本地订阅文件 ${targetFile} 成功！包含 ${data.vlessLinks.length} 个节点`
            : `✅ 更新本地订阅文件 ${targetFile} 成功！包含 ${data.vlessLinks.length} 个节点`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传本地订阅",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink(
            "localBase64Link",
            "localBase64Url",
            result.githubIoUrl,
          );

          // 同时上传对应的YAML配置文件
          try {
            const yamlFileName = toYamlFileName(targetFile);
            const yamlContent = generateClashYAML(data.vlessLinks);

            const yamlResult = await uploadToGitHub(
              yamlFileName,
              utf8ToBase64(yamlContent),
              false,
              `上传本地YAML配置 ${yamlFileName} - ${new Date().toLocaleString()} (${data.vlessLinks.length}节点)`,
            );

            const yamlMessage = yamlResult.isNew
              ? `✅ 新建YAML配置文件 ${yamlFileName} 成功！`
              : `✅ 更新YAML配置文件 ${yamlFileName} 成功！`;

            showNotification("YAML上传成功", yamlMessage, "success");
            addLog(
              "上传YAML配置",
              `${yamlMessage} (SHA: ${yamlResult.sha.substring(0, 8)}...)`,
              "success",
            );

            // 显示YAML配置文件的链接
            showGithubLink(
              "localYamlLink",
              "localYamlUrl",
              yamlResult.githubIoUrl,
            );
          } catch (yamlError) {
            console.warn("YAML文件上传失败，但节点文件已成功上传:", yamlError);
            showNotification(
              "YAML上传失败",
              "节点文件上传成功，但YAML配置文件上传失败: " + yamlError.message,
              "warning",
            );
          }
        } catch (e) {
          showNotification(
            "上传失败",
            "上传过程中发生错误: " + e.message,
            "error",
          );
          addLog("上传本地订阅", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadLocalBase64ToPathBtn");
        }
      }

      // 修复：上传合并Base64到Main
      async function uploadMergedBase64() {
        showLoading(true, "uploadMergedBase64Btn");
        try {
          if (data.uniqueNodes.length === 0) {
            showNotification(
              "上传失败",
              "请先合并节点，当前没有可上传的合并节点数据",
              "error",
            );
            showLoading(false, "uploadMergedBase64Btn");
            return;
          }

          const mainNodeFile = getGithubFileInputValue("mainNodeFile", "main");
          const plainText = data.uniqueNodes.join("\n");

          // 修复：双重Base64编码（符合订阅格式）
          const firstBase64 = utf8ToBase64(plainText);
          const finalContent = btoa(firstBase64);

          // 使用通用上传函数
          const result = await uploadToGitHub(
            mainNodeFile,
            finalContent,
            true,
            `上传合并Base64订阅到 ${mainNodeFile} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建Base64订阅文件 ${mainNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`
            : `✅ 更新Base64订阅文件 ${mainNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传合并Base64",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink(
            "mergedBase64Link",
            "mergedBase64Url",
            result.githubIoUrl,
          );

          // 同时上传对应的YAML配置文件
          try {
            const yamlFileName = toYamlFileName(mainNodeFile);
            const yamlContent = data.mergedYamlContent;

            const yamlResult = await uploadToGitHub(
              yamlFileName,
              utf8ToBase64(yamlContent),
              false,
              `上传合并YAML配置 ${yamlFileName} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );

            const yamlMessage = yamlResult.isNew
              ? `✅ 新建YAML配置文件 ${yamlFileName} 成功！`
              : `✅ 更新YAML配置文件 ${yamlFileName} 成功！`;

            showNotification("YAML上传成功", yamlMessage, "success");
            addLog(
              "上传YAML配置",
              `${yamlMessage} (SHA: ${yamlResult.sha.substring(0, 8)}...)`,
              "success",
            );

            // 显示YAML配置文件的链接
            showGithubLink(
              "mergedYamlLink",
              "mergedYamlUrl",
              yamlResult.githubIoUrl,
            );
          } catch (yamlError) {
            console.warn("YAML文件上传失败，但节点文件已成功上传:", yamlError);
            showNotification(
              "YAML上传失败",
              "节点文件上传成功，但YAML配置文件上传失败: " + yamlError.message,
              "warning",
            );
          }
        } catch (e) {
          showNotification(
            "上传失败",
            "上传过程中发生错误: " + e.message,
            "error",
          );
          addLog("上传合并Base64", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadMergedBase64Btn");
        }
      }

      // 修复：上传合并订阅到Optimal
      async function uploadMergedOptimal() {
        showLoading(true, "uploadMergedOptimalBtn");
        try {
          if (data.uniqueNodes.length === 0) {
            showNotification(
              "上传失败",
              "请先合并节点，当前没有可上传的合并节点数据",
              "error",
            );
            showLoading(false, "uploadMergedOptimalBtn");
            return;
          }

          const optimalNodeFile = getGithubFileInputValue(
            "optimalNodeFile",
            "optimal",
          );
          const plainText = data.uniqueNodes.join("\n");

          // 双重Base64编码（符合订阅格式）
          const firstBase64 = utf8ToBase64(plainText);
          const finalContent = btoa(firstBase64);

          // 使用通用上传函数
          const result = await uploadToGitHub(
            optimalNodeFile,
            finalContent,
            true,
            `上传合并优选订阅到 ${optimalNodeFile} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建优选订阅文件 ${optimalNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`
            : `✅ 更新优选订阅文件 ${optimalNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传合并优选订阅",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink(
            "mergedOptimalLink",
            "mergedOptimalUrl",
            result.githubIoUrl,
          );

          // 同时上传对应的YAML配置文件（使用与Main相同的文件名模式）
          try {
            const yamlFileName = toYamlFileName(optimalNodeFile);
            const yamlContent = data.mergedYamlContent;

            const yamlResult = await uploadToGitHub(
              yamlFileName,
              utf8ToBase64(yamlContent),
              false,
              `上传合并YAML配置 ${yamlFileName} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );

            const yamlMessage = yamlResult.isNew
              ? `✅ 新建YAML配置文件 ${yamlFileName} 成功！`
              : `✅ 更新YAML配置文件 ${yamlFileName} 成功！`;

            showNotification("YAML上传成功", yamlMessage, "success");
            addLog(
              "上传YAML配置",
              `${yamlMessage} (SHA: ${yamlResult.sha.substring(0, 8)}...)`,
              "success",
            );

            // 显示YAML配置文件的链接（复用mergedYamlLink）
            showGithubLink(
              "mergedYamlLink",
              "mergedYamlUrl",
              yamlResult.githubIoUrl,
            );
          } catch (yamlError) {
            console.warn("YAML文件上传失败，但节点文件已成功上传:", yamlError);
            showNotification(
              "YAML上传失败",
              "节点文件上传成功，但YAML配置文件上传失败: " + yamlError.message,
              "warning",
            );
          }
        } catch (e) {
          showNotification(
            "上传失败",
            "上传过程中发生错误: " + e.message,
            "error",
          );
          addLog("上传合并优选订阅", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadMergedOptimalBtn");
        }
      }

      // 新增：上传合并订阅至指定路径
      async function uploadMergedToPath() {
        showLoading(true, "uploadMergedToPathBtn");
        try {
          if (data.uniqueNodes.length === 0) {
            showNotification(
              "上传失败",
              "请先合并节点，当前没有可上传的合并节点数据",
              "error",
            );
            showLoading(false, "uploadMergedToPathBtn");
            return;
          }

          // 获取选择的上传路径
          const selection = resolveSelectedPathTarget(
            "uploadPathSelect",
            "customUploadPath",
          );
          if (!selection.file) {
            showNotification(
              "上传失败",
              "请输入自定义上传路径，或选择预定义路径",
              "error",
            );
            showLoading(false, "uploadMergedToPathBtn");
            return;
          }
          const targetFile = selection.file;
          const isPlain = selection.key === "plain";

          const plainText = data.uniqueNodes.join("\n");
          let contentToUpload = "";

          // 根据目标路径决定上传格式
          if (isPlain) {
            // Plain：上传明文节点
            contentToUpload = utf8ToBase64(plainText);
          } else {
            // Optimal、Main 和自定义路径：使用双重Base64编码
            const firstBase64 = utf8ToBase64(plainText);
            contentToUpload = btoa(firstBase64);
          }

          // 使用通用上传函数
          const result = await uploadToGitHub(
            targetFile,
            contentToUpload,
            !isPlain,
            `上传合并订阅到指定路径 ${targetFile} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建合并订阅文件 ${targetFile} 成功！包含 ${data.uniqueNodes.length} 个节点`
            : `✅ 更新合并订阅文件 ${targetFile} 成功！包含 ${data.uniqueNodes.length} 个节点`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传合并至指定路径",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink(
            "mergedToPathLink",
            "mergedToPathUrl",
            result.githubIoUrl,
          );

          // 同时上传对应的YAML配置文件
          try {
            const yamlFileName = toYamlFileName(targetFile);
            const yamlContent = data.mergedYamlContent;

            const yamlResult = await uploadToGitHub(
              yamlFileName,
              utf8ToBase64(yamlContent),
              false,
              `上传合并YAML配置 ${yamlFileName} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );

            const yamlMessage = yamlResult.isNew
              ? `✅ 新建YAML配置文件 ${yamlFileName} 成功！`
              : `✅ 更新YAML配置文件 ${yamlFileName} 成功！`;

            showNotification("YAML上传成功", yamlMessage, "success");
            addLog(
              "上传YAML配置",
              `${yamlMessage} (SHA: ${yamlResult.sha.substring(0, 8)}...)`,
              "success",
            );

            // 显示YAML配置文件的链接（复用mergedYamlLink）
            showGithubLink(
              "mergedYamlLink",
              "mergedYamlUrl",
              yamlResult.githubIoUrl,
            );
          } catch (yamlError) {
            console.warn("YAML文件上传失败，但节点文件已成功上传:", yamlError);
            showNotification(
              "YAML上传失败",
              "节点文件上传成功，但YAML配置文件上传失败: " + yamlError.message,
              "warning",
            );
          }
        } catch (e) {
          showNotification(
            "上传失败",
            "上传过程中发生错误: " + e.message,
            "error",
          );
          addLog("上传合并至指定路径", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadMergedToPathBtn");
        }
      }

      //一键同步(远端明文和本地明文)和(远端Base64和本地Base64)方法
      async function oneClickSync() {
        showLoading(true, "syncBtn");
        try {
          // 1. 解析本地节点
          if (data.vlessLinks.length === 0) {
            await generateVless();
            if (data.vlessLinks.length === 0)
              throw new Error("无本地节点可同步");
          }

          // 2. 从GitHub下载远程节点
          await downloadRemote();

          // 3. 合并去重
          mergeAndShow();

          // 4. 保存令牌
          const token = getGithubToken();
          if (!token) throw new Error("缺少GitHub Token");
          if (document.getElementById("saveToken").checked)
            localStorage.setItem(getGithubTokenStorageKey(), token);

          // 5. 获取配置
          const mainNodeFile = getGithubFileInputValue("mainNodeFile", "main");
          const plainNodeFile = getGithubFileInputValue(
            "plainNodeFile",
            "plain",
          );
          const optimalNodeFile = getGithubFileInputValue(
            "optimalNodeFile",
            "optimal",
          );
          const plainText = data.uniqueNodes.join("\n");

          // 双重Base64编码
          const firstBase64 = utf8ToBase64(plainText);
          const finalContent = btoa(firstBase64);

          // 6. 上传Base64订阅文件（Main）- 双重Base64编码
          const mainResult = await uploadToGitHub(
            mainNodeFile,
            finalContent,
            true,
            `一键同步更新Main - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
          );

          console.log("✅ Main 上传成功");

          // 7. 上传明文文件（Plain）
          try {
            await uploadToGitHub(
              plainNodeFile,
              utf8ToBase64(plainText),
              false,
              `一键同步明文节点到Plain - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );
            console.log("✅ Plain 上传成功");
          } catch (e) {
            console.warn("⚠️ Plain 上传失败，但Main已成功上传:", e);
            // 不抛出错误，继续执行
          }

          // 8. 上传合并订阅到Optimal
          try {
            await uploadToGitHub(
              optimalNodeFile,
              finalContent,
              true,
              `一键同步合并订阅到Optimal - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );
            console.log("✅ Optimal 上传成功");
          } catch (e) {
            console.warn("⚠️ Optimal 上传失败，但其他文件已成功上传:", e);
            // 不抛出错误，继续执行
          }

          // 9. 上传对应的YAML配置文件
          try {
            const yamlFileName = toYamlFileName(mainNodeFile);
            const yamlContent = data.mergedYamlContent;

            await uploadToGitHub(
              yamlFileName,
              utf8ToBase64(yamlContent),
              false,
              `一键同步YAML配置 ${yamlFileName} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
            );
            console.log("✅ YAML配置 上传成功");
          } catch (e) {
            console.warn("⚠️ YAML配置上传失败，但其他文件已成功上传:", e);
            // 不抛出错误，继续执行
          }

          // 10. 清除缓存更新标记
          data.cache.needsUpdate = false;

          showNotification(
            "一键同步成功",
            `成功同步 ${data.uniqueNodes.length} 个节点到GitHub三个文件和YAML配置，所有操作已完成！`,
            "success",
          );
          addLog(
            "一键同步",
            `成功同步 ${data.uniqueNodes.length} 个节点到GitHub三个文件和YAML配置`,
            "success",
          );
        } catch (e) {
          showNotification(
            "一键同步失败",
            "同步过程中发生错误: " + e.message,
            "error",
          );
          addLog("一键同步", "同步失败: " + e.message, "error");
        } finally {
          showLoading(false, "syncBtn");
        }
      }

      // 显示订阅链接的函数
      function showGithubLink(linkId, urlId, url) {
        const linkItem = document.getElementById(linkId);
        const urlInput = document.getElementById(urlId);
        const linksSection = document.getElementById("githubLinksSection");

        if (linkItem && urlInput) {
          urlInput.value = url;
          linkItem.style.display = "block";
          linksSection.style.display = "block";
        }
      }

      // 复制订阅链接的函数
      function copyGithubUrl(urlId) {
        const urlInput = document.getElementById(urlId);
        if (urlInput && urlInput.value) {
          copyText(urlInput.value);
          showNotification(
            "复制成功",
            "订阅链接已复制到剪贴板",
            "success",
          );
        }
      }

      // 下载代理工具配置文件的函数
      function downloadProxyConfig(toolType) {
        // 优先使用本地生成的Vless节点，如果没有则使用合并后的节点
        const nodes =
          data.vlessLinks.length > 0
            ? data.vlessLinks
            : data.uniqueNodes.length > 0
              ? data.uniqueNodes
              : [];

        if (nodes.length === 0) {
          showNotification(
            "下载失败",
            "没有可用的节点数据，请先生成Vless节点",
            "error",
          );
          return;
        }

        let content = "";
        let filename = "";
        let mimeType = "text/plain";

        if (toolType === "clash") {
          content = generateClashYAML(nodes);
          filename = `clash-config-${new Date().toISOString().split("T")[0]}${getYamlExtension()}`;
          mimeType = "application/x-yaml";
        } else {
          showNotification("错误", "不支持的代理工具类型", "error");
          return;
        }

        // 创建并下载文件
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification("下载成功", `${filename} 已下载`, "success");
        addLog(
          "配置文件下载",
          `下载了 Clash 配置文件，包含 ${nodes.length} 个节点`,
          "success",
        );
      }

