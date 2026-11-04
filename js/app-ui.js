      // 清除远程缓存函数
      function clearRemoteCache() {
        data.remoteNodes = [];
        data.nodeSha = null;
        data.plainSha = null;
        data.optimalSha = null;
        data.locationSha = null;
        displayRemoteVlessLinks();
        updateStats();
        console.log("🗑️ 远程缓存已清除");
        addLog("缓存清理", "远程节点缓存已清除", "info");
      }

      // 明文订阅上传
      async function uploadPlainNodes() {
        showLoading(true, "uploadPlainNodesBtn");
        try {
          if (data.uniqueNodes.length === 0) {
            showNotification(
              "错误",
              "请先合并节点，当前没有可上传的节点数据",
              "error",
            );
            showLoading(false, "uploadPlainNodesBtn");
            return;
          }

          const plainNodeFile = getGithubFileInputValue(
            "plainNodeFile",
            "plain",
          );
          const plainText = data.uniqueNodes.join("\n");

          // 使用通用上传函数
          const result = await uploadToGitHub(
            plainNodeFile,
            utf8ToBase64(plainText),
            false,
            `上传合并明文订阅到 ${plainNodeFile} - ${new Date().toLocaleString()} (${data.uniqueNodes.length}节点)`,
          );

          // 标记缓存需要更新
          data.cache.needsUpdate = true;

          const message = result.isNew
            ? `✅ 新建明文节点文件 ${plainNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`
            : `✅ 更新明文节点文件 ${plainNodeFile} 成功！包含 ${data.uniqueNodes.length} 个节点`;

          showNotification("上传成功", message, "success");
          addLog(
            "上传明文节点",
            `${message} (SHA: ${result.sha.substring(0, 8)}...)`,
            "success",
          );

          // 显示订阅链接
          showGithubLink("plainNodesLink", "plainNodesUrl", result.githubIoUrl);

          // 同时上传对应的YAML配置文件
          try {
            const yamlFileName = toYamlFileName(plainNodeFile);
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
          addLog("上传明文节点", "上传失败: " + e.message, "error");
        } finally {
          showLoading(false, "uploadPlainNodesBtn");
        }
      }

      // 初始化上传路径选择
      function initUploadPathSelect() {
        const uploadPathSelect = document.getElementById("uploadPathSelect");
        const customUploadPath = document.getElementById("customUploadPath");

        uploadPathSelect.addEventListener("change", function () {
          customUploadPath.classList.toggle("show", this.value === "custom");
          if (this.value !== "custom") {
            customUploadPath.value = "";
          }
        });
      }

      // 更新CSV输入框状态
      function updateCSVInputState() {
        const csvInput = document.getElementById("csvInput");
        const pasteTabBtn = document.querySelector(
          '.card-tab-btn[data-tab="paste-tab"]',
        );

        if (data.currentSource === "file") {
          // 有文件上传时，禁用粘贴输入框
          csvInput.disabled = true;
          csvInput.placeholder = "已上传文件，粘贴功能已禁用。请先移除文件。";
          pasteTabBtn.style.opacity = "0.6";
          pasteTabBtn.style.cursor = "not-allowed";
        } else {
          // 没有文件上传时，启用粘贴输入框
          csvInput.disabled = false;
          csvInput.placeholder =
            "支持多种格式，智能分割：\n1. 单行或多行格式（冒号,逗号，空格分隔）：\n2. 紧凑格式（一行多个）：\n3. 混合分隔符：\n4. 只有IP（使用默认端口）：";
          pasteTabBtn.style.opacity = "1";
          pasteTabBtn.style.cursor = "pointer";
        }
      }

      // 初始化标签页 - 修复：确保每个卡片的标签页独立
      function initTabs() {
        // 为每个卡片的标签页分别初始化
        const cards = document.querySelectorAll(".card");
        cards.forEach((card) => {
          const tabButtons = card.querySelectorAll(".card-tab-btn");
          if (tabButtons.length > 0) {
            tabButtons.forEach((button) => {
              button.addEventListener("click", (e) => {
                e.stopPropagation(); // 阻止事件冒泡
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
        });
      }

      // 初始化折叠面板
      function initAccordion() {
        const accordionToggle = document.getElementById("advancedConfigToggle");
        const accordionContent = document.getElementById(
          "advancedConfigContent",
        );

        accordionToggle.addEventListener("click", () => {
          accordionToggle.classList.toggle("active");
          accordionContent.classList.toggle("show");
        });
      }

      // 初始化标题显示/隐藏
      function initThemeToggle() {
        const root = document.documentElement;
        const stylesheet = document.getElementById("darkThemeStylesheet");
        const toggleBtn = document.getElementById("themeToggleBtn");
        const toggleIcon = document.getElementById("themeToggleIcon");
        const toggleLabel = document.getElementById("themeToggleLabel");
        const themeConfig = getWebConfig().theme || {};
        const themes = Array.isArray(themeConfig.list)
          ? themeConfig.list
          : [];
        if (!themes.length) return;

        let activeThemeIndex = Math.max(
          0,
          themes.findIndex((theme) => theme.id === root.dataset.theme),
        );

        function updateThemeControl() {
          const currentTheme = themes[activeThemeIndex];
          const nextTheme = themes[(activeThemeIndex + 1) % themes.length];
          toggleBtn.setAttribute("aria-pressed", String(currentTheme.dark));
          toggleBtn.setAttribute(
            "aria-label",
            `当前样式：${currentTheme.name}，点击切换到${nextTheme.name}`,
          );
          toggleIcon.textContent = currentTheme.icon;
          toggleLabel.textContent = `样式：${currentTheme.name}`;
        }

        updateThemeControl();
        initMobileThemeButtonDrag(toggleBtn);
        toggleBtn.addEventListener("click", () => {
          if (toggleBtn.dataset.dragged === "true") {
            delete toggleBtn.dataset.dragged;
            return;
          }

          activeThemeIndex = (activeThemeIndex + 1) % themes.length;
          const theme = themes[activeThemeIndex];
          root.dataset.theme = theme.id;
          stylesheet.disabled = !theme.dark;
          updateThemeControl();

          try {
            localStorage.setItem(
              themeConfig.storageKey || "vless-node-theme-v2",
              theme.id,
            );
          } catch (error) {
            console.warn("保存主题偏好失败", error);
          }
        });
      }

      function initMobileThemeButtonDrag(toggleBtn) {
        const quickActions = toggleBtn.parentElement;
        const themeConfig = getWebConfig().theme || {};
        const dragPositionKey =
          themeConfig.dragPositionStorageKey ||
          "vless-node-theme-button-position-v1";
        const mobileBreakpoint =
          Number(themeConfig.mobileBreakpoint) > 0
            ? Number(themeConfig.mobileBreakpoint)
            : 768;
        const mobileViewport = window.matchMedia(
          `(max-width: ${mobileBreakpoint}px)`,
        );
        let dragStart = null;
        let dragged = false;

        function clampPosition(left, top) {
          const buttonRect = toggleBtn.getBoundingClientRect();
          return {
            left: Math.max(0, Math.min(left, window.innerWidth - buttonRect.width)),
            top: Math.max(0, Math.min(top, window.innerHeight - buttonRect.height)),
          };
        }

        function setPosition(left, top) {
          const position = clampPosition(left, top);
          quickActions.style.left = `${position.left}px`;
          quickActions.style.top = `${position.top}px`;
          quickActions.style.right = "auto";
          quickActions.style.bottom = "auto";
          return position;
        }

        if (mobileViewport.matches) {
          try {
            const savedPosition = JSON.parse(
              localStorage.getItem(dragPositionKey) || "null",
            );
            if (
              savedPosition &&
              Number.isFinite(savedPosition.left) &&
              Number.isFinite(savedPosition.top)
            ) {
              setPosition(savedPosition.left, savedPosition.top);
            }
          } catch (error) {
            console.warn("读取主题按钮位置失败", error);
          }
        }

        toggleBtn.addEventListener("pointerdown", (event) => {
          if (!mobileViewport.matches || event.button !== 0) return;

          const rect = toggleBtn.getBoundingClientRect();
          dragStart = {
            pointerId: event.pointerId,
            pointerX: event.clientX,
            pointerY: event.clientY,
            left: rect.left,
            top: rect.top,
          };
          dragged = false;
          toggleBtn.setPointerCapture(event.pointerId);
        });

        toggleBtn.addEventListener("pointermove", (event) => {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return;

          const deltaX = event.clientX - dragStart.pointerX;
          const deltaY = event.clientY - dragStart.pointerY;
          if (!dragged && Math.hypot(deltaX, deltaY) < 6) return;

          dragged = true;
          event.preventDefault();
          const position = setPosition(
            dragStart.left + deltaX,
            dragStart.top + deltaY,
          );
          toggleBtn.dataset.dragged = "true";
          try {
            localStorage.setItem(dragPositionKey, JSON.stringify(position));
          } catch (error) {
            console.warn("保存主题按钮位置失败", error);
          }
        });

        function finishDrag(event) {
          if (!dragStart || event.pointerId !== dragStart.pointerId) return;
          if (toggleBtn.hasPointerCapture(event.pointerId)) {
            toggleBtn.releasePointerCapture(event.pointerId);
          }
          dragStart = null;
        }

        toggleBtn.addEventListener("pointerup", finishDrag);
        toggleBtn.addEventListener("pointercancel", finishDrag);
        window.addEventListener("resize", () => {
          if (!mobileViewport.matches || !quickActions.style.top) return;
          const rect = toggleBtn.getBoundingClientRect();
          setPosition(rect.left, rect.top);
        });
      }

      function initHeaderToggle() {
        const toggleBtn = document.getElementById("toggleHeaderBtn");
        const headerInfo = document.getElementById("headerInfo");

        toggleBtn.addEventListener("click", () => {
          if (headerInfo.classList.contains("hidden")) {
            headerInfo.classList.remove("hidden");
            toggleBtn.textContent = "隐藏";
            // showNotification('提示', '标题已显示', 'info');
          } else {
            headerInfo.classList.add("hidden");
            toggleBtn.textContent = "显示";
            // showNotification('提示', '标题已隐藏', 'info');
          }
        });
      }

      function initDragDrop() {
        const area = document.getElementById("dropArea");

        // 修复：确保拖拽功能正常工作
        ["dragenter", "dragover"].forEach((e) => {
          area.addEventListener(e, (event) => {
            event.preventDefault();
            event.stopPropagation();
            area.classList.add("dragover");
          });
        });

        ["dragleave", "drop"].forEach((e) => {
          area.addEventListener(e, (event) => {
            event.preventDefault();
            event.stopPropagation();
            area.classList.remove("dragover");
          });
        });

        // 修复：正确处理drop事件，支持多个文件
        area.addEventListener("drop", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            /\.(csv|txt)$/i.test(f.name),
          );
          if (files && files.length > 0) {
            handleFiles(files);
          }
        });

        area.addEventListener("click", () =>
          document.getElementById("fileInput").click(),
        );
      }

      // 新增：处理多个文件的函数
      async function handleFiles(files) {
        // 筛选有效的CSV/TXT文件
        const validFiles = files.filter((f) => /\.(csv|txt)$/i.test(f.name));

        if (validFiles.length === 0) {
          showNotification("文件错误", "请上传CSV或TXT文件", "error");
          addLog("文件操作", "未找到有效的CSV/TXT文件", "error");
          return;
        }

        const fileInput = document.getElementById("fileInput");
        const dataTransfer = new DataTransfer();
        validFiles.forEach((file) => dataTransfer.items.add(file));
        fileInput.files = dataTransfer.files;
        data.csvColumnDetection.detected = false;

        // 存储已上传的文件列表
        if (!data.uploadedFiles) {
          data.uploadedFiles = [];
        }
        data.uploadedFiles = validFiles;

        // 更新UI显示已上传文件信息
        const fileNameEl = document.getElementById("fileName");
        const fileSizeEl = document.getElementById("fileSize");

        if (validFiles.length === 1) {
          fileNameEl.textContent = validFiles[0].name;
          fileSizeEl.textContent = formatSize(validFiles[0].size);
        } else {
          const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
          fileNameEl.textContent = `已上传 ${validFiles.length} 个文件`;
          fileSizeEl.textContent = `(总大小: ${formatSize(totalSize)})`;
        }

        document.getElementById("fileInfo").classList.add("show");
        document.getElementById("dropArea").classList.add("has-file");
        document.getElementById("csvInput").value = "";
        data.currentSource = "file";
        updateSourceBadge();
        updateCSVInputState();

        // 读取所有文件并合并内容
        let combinedContent = "";
        let fileCount = 0;
        let errorCount = 0;
        let headerLine = ""; // 存储第一个有效的header行

        for (const file of validFiles) {
          try {
            const content = await readFileAsText(file);
            const lines = content.split(/\r?\n/);

            if (lines.length === 0) continue;

            if (!combinedContent) {
              // 第一个文件：完整保留
              combinedContent = content;
              headerLine = lines[0]; // 保存header行
            } else {
              // 后续文件：尝试移除header行，但保留所有数据行
              // 通过检查第一行是否看起来像header来决定是否跳过
              let skipFirstLine = false;
              if (lines.length > 1) {
                const firstLine = lines[0].toLowerCase();
                // 检查是否看起来像header（包含IP、port、city等关键词）
                const headerKeywords = [
                  "ip",
                  "host",
                  "address",
                  "port",
                  "city",
                  "country",
                  "region",
                  "speed",
                  "地址",
                  "端口",
                  "城市",
                  "国家",
                  "地区",
                  "速度",
                ];
                const keywordCount = headerKeywords.filter((kw) =>
                  firstLine.includes(kw),
                ).length;
                if (keywordCount >= 1) {
                  skipFirstLine = true;
                }
              }

              // 添加非header的行
              const dataLinesToAdd = skipFirstLine ? lines.slice(1) : lines;
              if (dataLinesToAdd.length > 0) {
                combinedContent += "\n" + dataLinesToAdd.join("\n");
              }
            }
            fileCount++;
          } catch (e) {
            errorCount++;
            addLog("文件操作", `文件读取失败: ${file.name}`, "error");
          }
        }

        // 将合并的内容设置到csvInput（用于解析）
        document.getElementById("csvInput").value = combinedContent;

        // 等待列检测完成，避免生成时使用上一次文件的列配置。
        const columnsDetected = await new Promise((resolve) =>
          autoDetectCSVColumns(validFiles[0], resolve),
        );
        if (columnsDetected) {
          await generateVless();
        }

        const message =
          validFiles.length === 1
            ? `成功上传文件: ${validFiles[0].name}`
            : `成功上传 ${fileCount} 个文件${errorCount > 0 ? `，${errorCount} 个失败` : ""}`;
        addLog("文件操作", message, "success");
        showNotification("上传成功", message, "success");
      }

      // 新增：异步读取文件为文本
      function readFileAsText(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      }

      function handleFile(file) {
        if (!/\.(csv|txt)$/i.test(file.name)) {
          showNotification(
            "文件错误",
            "请上传CSV或TXT文件，当前文件格式不支持",
            "error",
          );
          addLog("文件操作", `文件格式错误: ${file.name}`, "error");
          return;
        }

        // 修复：确保文件被正确设置到fileInput元素
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById("fileInput").files = dataTransfer.files;

        const reader = new FileReader();
        reader.onload = (e) => {
          data.currentSource = "file";
          document.getElementById("fileName").textContent = file.name;
          document.getElementById("fileSize").textContent = formatSize(
            file.size,
          );
          document.getElementById("fileInfo").classList.add("show");
          document.getElementById("dropArea").classList.add("has-file");
          document.getElementById("csvInput").value = "";
          updateSourceBadge();
          // 更新CSV输入框状态
          updateCSVInputState();

          // 文件上传后自动进行列检测
          autoDetectCSVColumns();

          // 修复：文件上传后自动生成节点
          setTimeout(() => {
            generateVless();
          }, 100);

          addLog("文件操作", `成功上传文件: ${file.name}`, "success");
        };
        reader.onerror = (e) => {
          showNotification(
            "文件读取失败",
            "无法读取文件内容，请检查文件是否损坏或重新上传",
            "error",
          );
          addLog(
            "文件操作",
            `文件读取失败: ${file.name} - ${e.message}`,
            "error",
          );
        };
        reader.readAsText(file);
      }

      function removeFile() {
        data.currentSource = "none";
        data.uploadedFiles = []; // 清除已上传文件列表
        document.getElementById("fileInfo").classList.remove("show");
        document.getElementById("dropArea").classList.remove("has-file");
        document.getElementById("fileInput").value = "";
        document.getElementById("fileName").textContent = "";
        document.getElementById("fileSize").textContent = "";
        updateSourceBadge();
        // 更新CSV输入框状态
        updateCSVInputState();

        // 清除检测结果
        document.getElementById("columnDetectionResult").style.display = "none";

        addLog("文件操作", "已移除上传的文件", "info");

        // 清空生成结果
        data.vlessLinks = [];
        data.localBase64Content = "";
        data.localYamlContent = "";
        data.autoBase64Content = "";
        data.mergedYamlContent = "";
        displayVlessLinks();
        document.getElementById("localBase64Output").textContent =
          "Base64订阅内容将在这里显示...";
        document.getElementById("localBase64Output").classList.add("empty");
        document.getElementById("localYamlOutput").textContent =
          "本地YAML配置将在这里显示...";
        document.getElementById("localYamlOutput").classList.add("empty");
        document.getElementById("autoBase64Output").textContent =
          "合并去重后将自动生成Base64订阅内容...";
        document.getElementById("autoBase64Output").classList.add("empty");
        document.getElementById("mergedYamlOutput").textContent =
          "合并后的YAML配置将在这里显示...";
        document.getElementById("mergedYamlOutput").classList.add("empty");
        updateStats();
      }

      function updateSourceBadge() {
        const badge = document.getElementById("sourceBadge");
        if (data.currentSource === "file") {
          const fileCount = data.uploadedFiles ? data.uploadedFiles.length : 1;
          badge.textContent =
            fileCount > 1 ? `已上传${fileCount}个文件` : "已上传文件";
        } else if (data.currentSource === "direct") {
          badge.textContent = "Vless直链";
        } else {
          badge.textContent = "粘贴内容";
        }
      }

      function getDirectVlessLinks() {
        const input = document.getElementById("vlessDirectInput").value;
        const links = input
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith("vless://"));
        return [...new Set(links)];
      }

      function syncHostAndSni(source, value) {
        const target = source === "host" ? "sni" : "host";
        document.getElementById(source).value = value;
        document.getElementById(target).value = value;
      }

      function updateDirectVlessConfig(link, config) {
        const url = new URL(link);
        if (url.protocol !== "vless:" || !url.username || !url.hostname) {
          throw new Error("Vless链接格式无效");
        }

        url.username = config.uuid;
        url.searchParams.set("host", config.host);
        url.searchParams.set("sni", config.sni);
        url.searchParams.set("path", config.customPath);
        if (url.searchParams.has("ech")) {
          if (config.ech) {
            url.searchParams.set("ech", config.ech);
          } else {
            url.searchParams.delete("ech");
          }
        }
        return url.toString();
      }

      function loadVlessDirect() {
        const links = getDirectVlessLinks();
        const input = document.getElementById("vlessDirectInput").value;
        const invalidLines = input
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith("vless://"));

        if (links.length === 0) {
          showNotification(
            "载入失败",
            "请粘贴至少一条以 vless:// 开头的直链",
            "error",
          );
          return;
        }

        data.currentSource = "direct";
        data.vlessLinks = links;
        data.uniqueNodes = [];
        data.stats.local = links.length;
        data.stats.merged = 0;
        data.stats.unique = 0;
        data.localBase64Content = utf8ToBase64(links.join("\n"));
        data.localYamlContent = generateClashYAML(links);
        data.cache.lastLocalGeneration = Date.now();

        document.getElementById("localBase64Output").textContent =
          data.localBase64Content;
        document.getElementById("localBase64Output").classList.remove("empty");
        document.getElementById("localYamlOutput").textContent =
          data.localYamlContent;
        document.getElementById("localYamlOutput").classList.remove("empty");
        updateSourceBadge();
        displayVlessLinks();
        updateStats();

        const warning =
          invalidLines.length > 0
            ? `，已忽略 ${invalidLines.length} 行非Vless内容`
            : "";
        showNotification(
          "直链载入成功",
          `已载入 ${links.length} 个Vless直链${warning}`,
          "success",
        );
        addLog(
          "载入Vless直链",
          `成功载入 ${links.length} 个原始Vless直链`,
          "success",
        );
      }

      function clearVlessDirect() {
        document.getElementById("vlessDirectInput").value = "";
        if (data.currentSource === "direct") {
          data.currentSource = "none";
          data.vlessLinks = [];
          data.localBase64Content = "";
          data.localYamlContent = "";
          displayVlessLinks();
          updateSourceBadge();
          updateStats();
        }
      }

